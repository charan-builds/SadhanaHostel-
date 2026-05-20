export type CacheEntry<T> = {
  value: T
  expiresAt: number
  tags: string[]
}

export type CacheSetOptions = {
  ttlMs: number
  tags?: string[]
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
  const cached = getCache<T>(key)

  if (cached !== null) {
    return cached
  }

  return setCache(key, await loader(), options)
}

export function invalidateCacheKey(key: string) {
  cacheStore.delete(key)
}

export function invalidateCacheByTag(tag: string) {
  cacheStore.forEach((entry, key) => {
    if (entry.tags.includes(tag)) {
      cacheStore.delete(key)
    }
  })
}

export function invalidateTenantCache(organizationId: string) {
  const prefix = `tenant:${organizationId}:`

  cacheStore.forEach((_entry, key) => {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key)
    }
  })
}

export function clearCache() {
  cacheStore.clear()
}
