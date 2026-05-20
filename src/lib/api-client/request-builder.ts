export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>

export type QueryParams = Record<string, QueryValue>

export function buildApiUrl(path: string, query?: QueryParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const params = new URLSearchParams()

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)))
      return
    }

    params.set(key, String(value))
  })

  const search = params.toString()

  return search ? `${normalizedPath}?${search}` : normalizedPath
}

export function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
