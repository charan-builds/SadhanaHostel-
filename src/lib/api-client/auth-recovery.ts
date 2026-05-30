import type { FrontendApiError } from "./api-fetch"

export const API_AUTH_FAILURE_EVENT = "sadhana:api-auth-failure"

export type ApiAuthFailureEventDetail = {
  path: string
  status: number
  code: string
  message: string
  requestId?: string
}

export function isRecoverableAuthFailure(error: FrontendApiError) {
  return error.status === 401 || error.code === "UNAUTHORIZED"
}

export function notifyApiAuthFailure(path: string, error: FrontendApiError) {
  if (typeof window === "undefined" || !isRecoverableAuthFailure(error)) {
    return
  }

  window.dispatchEvent(
    new CustomEvent<ApiAuthFailureEventDetail>(API_AUTH_FAILURE_EVENT, {
      detail: {
        path,
        status: error.status,
        code: error.code,
        message: error.message,
        requestId: error.requestId,
      },
    })
  )
}

export function subscribeToApiAuthFailures(
  callback: (detail: ApiAuthFailureEventDetail) => void
) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const listener = (event: Event) => {
    callback((event as CustomEvent<ApiAuthFailureEventDetail>).detail)
  }

  window.addEventListener(API_AUTH_FAILURE_EVENT, listener)

  return () => window.removeEventListener(API_AUTH_FAILURE_EVENT, listener)
}
