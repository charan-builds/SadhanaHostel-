import * as Sentry from "@sentry/nextjs"

import { notifyApiAuthFailure } from "./auth-recovery"
import { buildApiUrl, createRequestId, type QueryParams } from "./request-builder"

const DEFAULT_API_TIMEOUT_MS = 20_000

export type ApiSuccessResponse<T> = {
  success: true
  data: T
  message: string
  meta?: Record<string, unknown>
}

export type ApiFailureResponse = {
  success: false
  error: {
    code: string
    message: string
    requestId?: string
    details?: unknown
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse

export type ApiFetchOptions<TBody = unknown> = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  query?: QueryParams
  body?: TBody
  headers?: HeadersInit
  signal?: AbortSignal
  retry?: number
  auth?: boolean
  timeoutMs?: number
}

export class FrontendApiError extends Error {
  readonly code: string
  readonly status: number
  readonly requestId?: string
  readonly details?: unknown

  constructor(input: {
    code: string
    message: string
    status: number
    requestId?: string
    details?: unknown
  }) {
    super(input.message)
    this.name = "FrontendApiError"
    this.code = input.code
    this.status = input.status
    this.requestId = input.requestId
    this.details = input.details
  }
}

export async function apiFetch<TData, TBody = unknown>(
  path: string,
  options: ApiFetchOptions<TBody> = {}
): Promise<TData> {
  const retryCount = options.retry ?? 1
  let lastError: unknown

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await executeApiFetch<TData, TBody>(path, options)
    } catch (error) {
      lastError = error

      if (!shouldRetry(error, attempt, retryCount)) {
        throw error
      }

      await sleep(150 * (attempt + 1))
    }
  }

  throw lastError
}

async function executeApiFetch<TData, TBody>(
  path: string,
  options: ApiFetchOptions<TBody>
) {
  const requestId = createRequestId()
  const headers = new Headers(options.headers)
  const timeout = createTimeoutSignal(options.signal, options.timeoutMs)

  headers.set("x-request-id", requestId)
  headers.set("accept", "application/json")

  const body = buildRequestBody(options.body, headers)
  let response: Response

  try {
    response = await fetch(buildApiUrl(path, options.query), {
      method: options.method ?? (body ? "POST" : "GET"),
      credentials: "include",
      headers,
      body,
      signal: timeout.signal,
    })
  } catch (error) {
    const apiError = normalizeFetchFailure(error, requestId, timeout.didTimeout())
    captureApiFailure(path, apiError)
    throw apiError
  } finally {
    timeout.cleanup()
  }

  const responseRequestId = response.headers.get("x-request-id") ?? requestId
  const payload = await parseApiPayload<TData>(response, responseRequestId)

  if (!response.ok || !payload.success) {
    const error = normalizeApiFailure(payload, response, responseRequestId)
    const status =
      error.code === "MALFORMED_API_RESPONSE" && response.ok
        ? 502
        : response.status

    const apiError = new FrontendApiError({
      code: error.code,
      message: error.message,
      status,
      requestId: error.requestId ?? responseRequestId,
      details: "details" in error ? error.details : undefined,
    })

    captureApiFailure(path, apiError)
    if (path !== "/api/auth/session") {
      notifyApiAuthFailure(path, apiError)
    }

    throw apiError
  }

  return payload.data
}

function buildRequestBody<TBody>(body: TBody | undefined, headers: Headers) {
  if (body === undefined || body === null) {
    return undefined
  }

  if (body instanceof FormData) {
    return body
  }

  if (body instanceof Blob || typeof body === "string") {
    return body
  }

  headers.set("content-type", "application/json")

  return JSON.stringify(body)
}

async function parseApiPayload<TData>(
  response: Response,
  requestId: string
): Promise<ApiResponse<TData>> {
  const contentType = response.headers.get("content-type")

  if (response.status === 204) {
    return {
      success: true,
      data: null as TData,
      message: "Request completed successfully.",
    }
  }

  if (!contentType?.includes("application/json")) {
    if (response.ok) {
      return {
        success: true,
        data: (await response.blob()) as TData,
        message: "Request completed successfully.",
      }
    }

    return {
      success: false,
      error: {
        code: `HTTP_${response.status}`,
        message: response.statusText || "Request failed.",
        requestId,
      },
    }
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    return {
      success: false,
      error: {
        code: "MALFORMED_API_RESPONSE",
        message: "The server returned invalid JSON. Retry the request.",
        requestId,
      },
    }
  }

  if (isApiResponse<TData>(payload)) {
    return payload
  }

  return {
    success: false,
    error: {
      code: "MALFORMED_API_RESPONSE",
      message: "The server returned an unexpected response. Retry the request.",
      requestId,
      details: response.ok ? undefined : payload,
    },
  }
}

function normalizeApiFailure<TData>(
  payload: ApiResponse<TData>,
  response: Response,
  requestId: string
): ApiFailureResponse["error"] {
  if (payload.success) {
    return {
      code: `HTTP_${response.status}`,
      message: response.statusText || "Request failed.",
      requestId,
    }
  }

  return {
    code: typeof payload.error.code === "string" ? payload.error.code : `HTTP_${response.status}`,
    message:
      typeof payload.error.message === "string" && payload.error.message.trim()
        ? payload.error.message
        : response.statusText || "Request failed.",
    requestId: payload.error.requestId ?? requestId,
    details: payload.error.details,
  }
}

function isApiResponse<TData>(payload: unknown): payload is ApiResponse<TData> {
  if (!payload || typeof payload !== "object" || !("success" in payload)) {
    return false
  }

  const candidate = payload as { success?: unknown; error?: unknown; data?: unknown }

  if (candidate.success === true) {
    return "data" in candidate
  }

  if (candidate.success !== false || !candidate.error || typeof candidate.error !== "object") {
    return false
  }

  const error = candidate.error as { code?: unknown; message?: unknown }

  return typeof error.code === "string" && typeof error.message === "string"
}

function normalizeFetchFailure(
  error: unknown,
  requestId: string,
  timedOut: boolean
) {
  if (timedOut) {
    return new FrontendApiError({
      code: "REQUEST_TIMEOUT",
      message: "The request timed out. Check your connection and try again.",
      status: 0,
      requestId,
    })
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new FrontendApiError({
      code: "REQUEST_ABORTED",
      message: "The request was cancelled.",
      status: 0,
      requestId,
    })
  }

  return new FrontendApiError({
    code: "NETWORK_ERROR",
    message: "Network request failed. Check your connection and try again.",
    status: 0,
    requestId,
    details: error instanceof Error ? { name: error.name, message: error.message } : undefined,
  })
}

function createTimeoutSignal(externalSignal?: AbortSignal, timeoutMs = DEFAULT_API_TIMEOUT_MS) {
  const controller = new AbortController()
  let timedOut = false
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true
          controller.abort()
        }, timeoutMs)
      : undefined

  if (externalSignal?.aborted) {
    controller.abort()
  } else {
    externalSignal?.addEventListener("abort", () => controller.abort(), { once: true })
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    },
  }
}

function captureApiFailure(path: string, apiError: FrontendApiError) {
  const tags = {
    request_id: apiError.requestId,
    api_path: path,
    api_status: String(apiError.status),
  }

  if (apiError.status >= 500 || apiError.status === 0) {
    Sentry.captureException(apiError, {
      tags,
      extra: {
        code: apiError.code,
      },
    })
    return
  }

  Sentry.addBreadcrumb({
    category: "api",
    level: apiError.status === 401 || apiError.status === 403 ? "warning" : "info",
    message: apiError.message,
    data: {
      path,
      status: apiError.status,
      code: apiError.code,
      requestId: apiError.requestId,
    },
  })
}

function shouldRetry(error: unknown, attempt: number, retryCount: number) {
  if (attempt >= retryCount) {
    return false
  }

  if (error instanceof FrontendApiError) {
    return (
      error.status >= 500 ||
      error.status === 429 ||
      error.code === "NETWORK_ERROR" ||
      error.code === "REQUEST_TIMEOUT"
    )
  }

  return true
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
