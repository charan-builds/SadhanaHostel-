import { ApiError } from "@/lib/api/api-error"

export const ORIGIN_SECURITY_ERROR_CODE = "CSRF_ORIGIN_BLOCKED"

type OriginSecurityAllowReason =
  | "safe_method"
  | "same_origin_header"
  | "same_origin_referer"
  | "same_origin_fetch_metadata"
  | "non_cookie_api_client"

type OriginSecurityRejectReason =
  | "cross_site_fetch_metadata"
  | "untrusted_origin"
  | "untrusted_referer"
  | "invalid_referer"
  | "missing_browser_origin"

export type OriginSecurityResult =
  | {
      allowed: true
      reason: OriginSecurityAllowReason
    }
  | {
      allowed: false
      reason: OriginSecurityRejectReason
      message: string
      details: {
        allowedOrigins: string[]
        requestOrigin: string
      }
    }

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])
const TRUSTED_FETCH_SITES = new Set(["same-origin", "none"])
const SAME_SITE_FETCH_SITE = "same-site"

export function validateSameOriginMutation(request: Request): OriginSecurityResult {
  if (!isMutationMethod(request.method)) {
    return { allowed: true, reason: "safe_method" }
  }

  const allowedOrigins = getAllowedOrigins(request)
  const requestOrigin = getRequestOrigin(request)
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase()

  if (fetchSite === "cross-site") {
    return reject("cross_site_fetch_metadata", allowedOrigins, requestOrigin)
  }

  const origin = request.headers.get("origin")

  if (origin) {
    if (isAllowedOrigin(origin, allowedOrigins)) {
      return { allowed: true, reason: "same_origin_header" }
    }

    return reject("untrusted_origin", allowedOrigins, requestOrigin)
  }

  const referer = request.headers.get("referer")

  if (referer) {
    const refererOrigin = getUrlOrigin(referer)

    if (!refererOrigin) {
      return reject("invalid_referer", allowedOrigins, requestOrigin)
    }

    if (isAllowedOrigin(refererOrigin, allowedOrigins)) {
      return { allowed: true, reason: "same_origin_referer" }
    }

    return reject("untrusted_referer", allowedOrigins, requestOrigin)
  }

  if (fetchSite && TRUSTED_FETCH_SITES.has(fetchSite)) {
    return { allowed: true, reason: "same_origin_fetch_metadata" }
  }

  if (!hasCookieCredentials(request) || hasBearerAuthorization(request)) {
    return { allowed: true, reason: "non_cookie_api_client" }
  }

  if (fetchSite === SAME_SITE_FETCH_SITE) {
    return reject("missing_browser_origin", allowedOrigins, requestOrigin)
  }

  return reject("missing_browser_origin", allowedOrigins, requestOrigin)
}

export function assertSameOriginMutation(request: Request) {
  const result = validateSameOriginMutation(request)

  if (!result.allowed) {
    throw new ApiError(
      ORIGIN_SECURITY_ERROR_CODE,
      result.message,
      403,
      result.details
    )
  }
}

export function isMutationMethod(method: string) {
  return MUTATION_METHODS.has(method.toUpperCase())
}

export function getAllowedOrigins(request: Request) {
  const origins = new Set<string>()
  const requestOrigin = getRequestOrigin(request)

  addOrigin(origins, requestOrigin)
  addOrigin(origins, process.env.NEXT_PUBLIC_APP_URL)
  addOrigin(origins, process.env.APP_URL)
  addOrigin(origins, process.env.VERCEL_URL)
  addOrigin(origins, process.env.VERCEL_PROJECT_PRODUCTION_URL)

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"))
  const host = forwardedHost ?? firstHeaderValue(request.headers.get("host"))

  if (host) {
    const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"))
    const protocol = forwardedProto ?? getUrlProtocol(request.url) ?? "https"

    addOrigin(origins, `${protocol}://${host}`)
  }

  return [...origins].sort()
}

function reject(
  reason: OriginSecurityRejectReason,
  allowedOrigins: string[],
  requestOrigin: string
): OriginSecurityResult {
  return {
    allowed: false,
    reason,
    message: "Cross-site mutation blocked.",
    details: {
      allowedOrigins,
      requestOrigin,
    },
  }
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]) {
  const normalized = normalizeOrigin(origin)

  return Boolean(normalized && allowedOrigins.includes(normalized))
}

function addOrigin(origins: Set<string>, value?: string | null) {
  const normalized = normalizeOrigin(value)

  if (normalized) {
    origins.add(normalized)
  }
}

function normalizeOrigin(value?: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`
  const origin = getUrlOrigin(candidate)

  return origin?.toLowerCase() ?? null
}

function getRequestOrigin(request: Request) {
  return getUrlOrigin(request.url) ?? "unknown"
}

function getUrlOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getUrlProtocol(value: string) {
  try {
    return new URL(value).protocol.replace(":", "")
  } catch {
    return null
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(",").at(0)?.trim() || null
}

function hasCookieCredentials(request: Request) {
  return Boolean(request.headers.get("cookie"))
}

function hasBearerAuthorization(request: Request) {
  return request.headers.get("authorization")?.toLowerCase().startsWith("bearer ") ?? false
}
