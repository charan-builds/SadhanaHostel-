import { getCurrentAccessToken } from "./auth-token"
import { buildApiUrl, createRequestId, type QueryParams } from "./request-builder"

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

  headers.set("x-request-id", requestId)
  headers.set("accept", "application/json")

  if (options.auth !== false) {
    const token = await getCurrentAccessToken()

    if (token) {
      headers.set("authorization", `Bearer ${token}`)
    }
  }

  const body = buildRequestBody(options.body, headers)
  const response = await fetch(buildApiUrl(path, options.query), {
    method: options.method ?? (body ? "POST" : "GET"),
    credentials: "include",
    headers,
    body,
    signal: options.signal,
  })
  const responseRequestId = response.headers.get("x-request-id") ?? requestId
  const payload = await parseApiPayload<TData>(response)

  if (!response.ok || !payload.success) {
    const error = payload.success
      ? {
          code: `HTTP_${response.status}`,
          message: response.statusText || "Request failed.",
          requestId: responseRequestId,
        }
      : payload.error

    throw new FrontendApiError({
      code: error.code,
      message: error.message,
      status: response.status,
      requestId: error.requestId ?? responseRequestId,
      details: "details" in error ? error.details : undefined,
    })
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

async function parseApiPayload<TData>(response: Response): Promise<ApiResponse<TData>> {
  const contentType = response.headers.get("content-type")

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
      },
    }
  }

  return (await response.json()) as ApiResponse<TData>
}

function shouldRetry(error: unknown, attempt: number, retryCount: number) {
  if (attempt >= retryCount) {
    return false
  }

  if (error instanceof FrontendApiError) {
    return error.status >= 500 || error.status === 429
  }

  return true
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
