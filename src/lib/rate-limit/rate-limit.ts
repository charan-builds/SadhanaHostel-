import { getServerEnv } from "@/config/env"
import { RateLimitError } from "@/lib/errors"
import { logger } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"

export type RateLimitPolicy = {
  name: string
  limit: number
  windowMs: number
}

export type RateLimitScope = {
  organizationId?: string | null
  userId?: string | null
  tenantKey?: string | null
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

export const RATE_LIMIT_POLICIES = {
  login: {
    name: "auth.login",
    limit: 5,
    windowMs: 60_000,
  },
  passwordReset: {
    name: "auth.password_reset",
    limit: 3,
    windowMs: 5 * 60_000,
  },
  uploads: {
    name: "uploads.write",
    limit: 20,
    windowMs: 60_000,
  },
  paymentCreate: {
    name: "payments.create",
    limit: 10,
    windowMs: 60_000,
  },
  leaveSubmit: {
    name: "leaves.submit",
    limit: 10,
    windowMs: 60_000,
  },
} satisfies Record<string, RateLimitPolicy>

const buckets = new Map<string, RateLimitBucket>()
let lastPrunedAt = 0

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null
  }

  return request.headers.get("x-real-ip") ?? "unknown"
}

export function buildRateLimitKey(
  request: Request,
  policy: RateLimitPolicy,
  scope: RateLimitScope = {}
) {
  const ip = getClientIp(request)
  const tenant = scope.organizationId ?? scope.tenantKey ?? "public"
  const actor = scope.userId ?? ip

  return [policy.name, tenant, actor].join(":")
}

export function assertRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  scope: RateLimitScope = {}
) {
  let enabled = true

  try {
    enabled = getServerEnv().RATE_LIMIT_ENABLED
  } catch {
    enabled = process.env.RATE_LIMIT_ENABLED !== "false"
  }

  if (!enabled) {
    return
  }

  try {
    pruneExpiredBuckets()

    const now = Date.now()
    const key = buildRateLimitKey(request, policy, scope)
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + policy.windowMs,
      })
      return
    }

    bucket.count += 1

    if (bucket.count <= policy.limit) {
      return
    }

    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000)

    incrementMetric("rate_limit.hits", 1, {
      policy: policy.name,
    })

    throw new RateLimitError("Too many requests. Please try again later.", {
      policy: policy.name,
      limit: policy.limit,
      windowMs: policy.windowMs,
      retryAfterSeconds,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error
    }

    logger.warn({
      event: "rate_limit.fallback_allowed",
      message: "Rate limiter failed open to preserve availability.",
      error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
      metadata: {
        policy: policy.name,
      },
    })
  }
}

export function resetRateLimitBuckets() {
  buckets.clear()
}

function pruneExpiredBuckets() {
  const now = Date.now()

  if (now - lastPrunedAt < 60_000) {
    return
  }

  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  })

  lastPrunedAt = now
}
