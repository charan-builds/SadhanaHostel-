import type { ApiResponse } from "@/lib/api"

export function createJsonRequest(
  path: string,
  body?: Record<string, unknown>,
  init: RequestInit = {}
) {
  const method = init.method ?? "POST"
  const headers = withBrowserMutationHeaders(
    {
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
    method
  )

  return new Request(`http://localhost${path}`, {
    ...init,
    method,
    headers,
    body: body ? JSON.stringify(body) : init.body,
  })
}

export function createGetRequest(path: string, query: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`)

  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return new Request(url, {
    method: "GET",
  })
}

export function createMultipartRequest(path: string, fields: Record<string, string>, file: File) {
  const formData = new FormData()

  Object.entries(fields).forEach(([key, value]) => {
    formData.set(key, value)
  })
  formData.set("file", file)

  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: withBrowserMutationHeaders({}, "POST"),
    body: formData,
  })
}

export async function readApiResponse<T>(response: Response) {
  return (await response.json()) as ApiResponse<T>
}

export function routeContext<TParams extends Record<string, string>>(params: TParams) {
  return {
    params: Promise.resolve(params),
  }
}

function withBrowserMutationHeaders(headersInit: HeadersInit, method: string) {
  const headers = new Headers(headersInit)
  const normalizedMethod = method.toUpperCase()

  if (["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) {
    if (!headers.has("origin")) {
      headers.set("origin", "http://localhost")
    }

    if (!headers.has("sec-fetch-site")) {
      headers.set("sec-fetch-site", "same-origin")
    }
  }

  return headers
}
