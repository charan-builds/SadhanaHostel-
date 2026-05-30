export type CacheEntry<T> = {
  value: T
  expiresAt: number
  tags: string[]
}

export type CacheSetOptions = {
  ttlMs: number
  tags?: string[]
}

type RedisConfig = {
  url: string
  token: string
}

const cacheStore = new Map<string, CacheEntry<unknown>>()

export function buildTenantCacheKey(parts: {
  organizationId: string
  scope: string
  identifier: string
  hostelId?: string | null
}) {
  return [
    "tenant",
    parts.organizationId,
    parts.hostelId ?? "global",
    parts.scope,
    parts.identifier,
  ].join(":")
}

export function getCache<T>(key: string): T | null {
  const entry = cacheStore.get(key)

  if (!entry) {
    return null
  }

  if (entry.expiresAt <= Date.now()) {
    cacheStore.delete(key)
    return null
  }

  return entry.value as T
}

export function setCache<T>(key: string, value: T, options: CacheSetOptions) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + options.ttlMs,
    tags: options.tags ?? [],
  })

  return value
}

export async function getOrSetCache<T>(
  key: string,
  options: CacheSetOptions,
  loader: () => Promise<T>
) {
  const redisConfig = getRedisConfig()

  if (redisConfig) {
    try {
      const cached = await getRedisCache<T>(redisConfig, key)

      if (cached !== null) {
        return cached
      }

      const loaded = await loader()
      await setRedisCache(redisConfig, key, loaded, options)

      return loaded
    } catch {
      // Keep production availability if the distributed cache is unavailable.
    }
  }

  const cached = getCache<T>(key)

  if (cached !== null) {
    return cached
  }

  return setCache(key, await loader(), options)
}

export function clearCache() {
  cacheStore.clear()
}

function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (!url || !token) {
    return null
  }

  return { url, token }
}

async function getRedisCache<T>(config: RedisConfig, key: string) {
  const raw = await runRedisCommand<string | null>(config, ["GET", key])

  if (!raw) {
    return null
  }

  const parsed = JSON.parse(raw) as { value: T }

  return parsed.value
}

async function setRedisCache<T>(
  config: RedisConfig,
  key: string,
  value: T,
  options: CacheSetOptions
) {
  await runRedisCommand<string>(config, [
    "SET",
    key,
    JSON.stringify({ value }),
    "PX",
    options.ttlMs,
  ])
  await registerRedisCacheIndexes(config, key, options)

  return value
}

export async function invalidateCacheKey(key: string) {
  cacheStore.delete(key)

  const redisConfig = getRedisConfig()

  if (!redisConfig) {
    return
  }

  try {
    await runRedisCommand<number>(redisConfig, ["DEL", key])
  } catch {
    // Cache invalidation must not break the primary workflow.
  }
}

export async function invalidateCacheByTag(tag: string) {
  cacheStore.forEach((entry, key) => {
    if (entry.tags.includes(tag)) {
      cacheStore.delete(key)
    }
  })

  const redisConfig = getRedisConfig()

  if (!redisConfig) {
    return
  }

  try {
    await invalidateRedisIndex(redisConfig, redisTagKey(tag))
  } catch {
    // Cache invalidation must not break the primary workflow.
  }
}

export async function invalidateTenantCache(organizationId: string) {
  const prefix = `tenant:${organizationId}:`

  cacheStore.forEach((_entry, key) => {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key)
    }
  })

  const redisConfig = getRedisConfig()

  if (!redisConfig) {
    return
  }

  try {
    await invalidateRedisIndex(redisConfig, redisTenantKey(organizationId))
  } catch {
    // Cache invalidation must not break the primary workflow.
  }
}

async function registerRedisCacheIndexes(
  config: RedisConfig,
  key: string,
  options: CacheSetOptions
) {
  const indexKeys = [
    ...(options.tags ?? []).map(redisTagKey),
    ...redisTenantIndexKeys(key),
  ]

  await Promise.all(
    indexKeys.map((indexKey) =>
      runRedisCommand<number>(config, ["SADD", indexKey, key])
    )
  )
}

async function invalidateRedisIndex(config: RedisConfig, indexKey: string) {
  const keys = await runRedisCommand<string[]>(config, ["SMEMBERS", indexKey])

  if (keys.length > 0) {
    await runRedisCommand<number>(config, ["DEL", ...keys])
  }

  await runRedisCommand<number>(config, ["DEL", indexKey])
}

function redisTagKey(tag: string) {
  return `cache-tag:${tag}`
}

function redisTenantKey(organizationId: string) {
  return `cache-tenant:${organizationId}`
}

function redisTenantIndexKeys(key: string) {
  const [prefix, organizationId] = key.split(":")

  if (prefix !== "tenant" || !organizationId) {
    return []
  }

  return [redisTenantKey(organizationId)]
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
    throw new Error(`Redis cache command failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as { result?: T; error?: string }

  if (payload.error) {
    throw new Error(payload.error)
  }

  return payload.result as T
}
