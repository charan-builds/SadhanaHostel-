import { NextResponse } from "next/server"

import { toApiError, type ApiErrorPayload } from "@/lib/api/api-error"

export type ApiSuccessResponse<T> = {
  success: true
  data: T
  message: string
  meta?: Record<string, unknown>
}

export type ApiFailureResponse = {
  success: false
  error: ApiErrorPayload
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse

export function successResponse<T>(
  data: T,
  message = "Request completed successfully.",
  init?: ResponseInit & { meta?: Record<string, unknown> }
) {
  const { meta, ...responseInit } = init ?? {}

  return NextResponse.json<ApiSuccessResponse<T>>(
    {
      success: true,
      data,
      message,
      ...(meta ? { meta } : {}),
    },
    responseInit
  )
}

export function createdResponse<T>(
  data: T,
  message = "Resource created successfully.",
  init?: ResponseInit & { meta?: Record<string, unknown> }
) {
  return successResponse(data, message, {
    ...init,
    status: init?.status ?? 201,
  })
}

export function errorResponse(error: unknown) {
  const apiError = toApiError(error)

  return NextResponse.json<ApiFailureResponse>(
    {
      success: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details ? { details: apiError.details } : {}),
      },
    },
    {
      status: apiError.statusCode,
    }
  )
}

export function emptySuccessResponse(message = "Request completed successfully.") {
  return successResponse<null>(null, message)
}
