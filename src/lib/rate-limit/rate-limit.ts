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

type RedisConfig = {
  url: string
  token: string
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
  inviteActivation: {
    name: "auth.invite_activation",
    limit: 8,
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
  search: {
    name: "search.read",
    limit: 60,
    windowMs: 60_000,
  },
  support: {
    name: "support.write",
    limit: 8,
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

export async function assertRateLimit(
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
    const key = buildRateLimitKey(request, policy, scope)
    const redisConfig = getRedisConfig()

    if (redisConfig) {
      await assertRedisRateLimit(redisConfig, key, policy)
      return
    }

    pruneExpiredBuckets()

    const now = Date.now()
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

function getRedisConfig(): RedisConfig | null {
  try {
    const env = getServerEnv()

    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      return {
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      }
    }
  } catch {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

    if (url && token) {
      return { url, token }
    }
  }

  return null
}

async function assertRedisRateLimit(
  config: RedisConfig,
  key: string,
  policy: RateLimitPolicy
) {
  const count = await runRedisCommand<number>(config, ["INCR", key])

  if (count === 1) {
    await runRedisCommand<number>(config, ["PEXPIRE", key, policy.windowMs])
  }

  if (count <= policy.limit) {
    return
  }

  const ttlMs = await runRedisCommand<number>(config, ["PTTL", key])
  const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000))

  incrementMetric("rate_limit.hits", 1, {
    policy: policy.name,
    backend: "upstash",
  })

  throw new RateLimitError("Too many requests. Please try again later.", {
    policy: policy.name,
    limit: policy.limit,
    windowMs: policy.windowMs,
    retryAfterSeconds,
  })
}

async function runRedisCommand<T>(
  config: RedisConfig,
  command: Array<string | number>
): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Redis rate-limit command failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as { result?: T; error?: string }

  if (payload.error) {
    throw new Error(payload.error)
  }

  return payload.result as T
}
