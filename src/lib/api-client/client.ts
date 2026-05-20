import { apiFetch, type ApiFetchOptions } from "./api-fetch"
import type { QueryParams } from "./request-builder"

export class ApiClient {
  get<TData>(path: string, query?: QueryParams, options?: ApiFetchOptions) {
    return apiFetch<TData>(path, {
      ...options,
      method: "GET",
      query,
    })
  }

  post<TData, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: ApiFetchOptions<TBody>
  ) {
    return apiFetch<TData, TBody>(path, {
      ...options,
      method: "POST",
      body,
    })
  }

  patch<TData, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: ApiFetchOptions<TBody>
  ) {
    return apiFetch<TData, TBody>(path, {
      ...options,
      method: "PATCH",
      body,
    })
  }

  delete<TData>(path: string, query?: QueryParams, options?: ApiFetchOptions) {
    return apiFetch<TData>(path, {
      ...options,
      method: "DELETE",
      query,
    })
  }
}

export const apiClient = new ApiClient()
