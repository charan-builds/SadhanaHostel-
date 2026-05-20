export const API_VERSIONS = ["v1"] as const

export type ApiVersion = (typeof API_VERSIONS)[number]

export const CURRENT_API_VERSION: ApiVersion = "v1"

export function versionedApiPath(path: string, version: ApiVersion = CURRENT_API_VERSION) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  return `/api/${version}${normalizedPath}`
}
