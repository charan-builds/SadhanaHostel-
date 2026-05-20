export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR"

export type ApiErrorPayload = {
  code: ApiErrorCode | string
  message: string
  details?: unknown
}

export class ApiError extends Error {
  readonly code: ApiErrorCode | string
  readonly statusCode: number
  readonly details?: unknown

  constructor(
    code: ApiErrorCode | string,
    message: string,
    statusCode = 500,
    details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof ZodError) {
    return validationError("Validation failed.", error.flatten())
  }

  if (error instanceof Error) {
    return new ApiError("INTERNAL_ERROR", error.message, 500)
  }

  return new ApiError("INTERNAL_ERROR", "An unexpected error occurred.", 500)
}

export function badRequest(message: string, details?: unknown) {
  return new ApiError("BAD_REQUEST", message, 400, details)
}

export function unauthorized(message = "Authentication is required.") {
  return new ApiError("UNAUTHORIZED", message, 401)
}

export function forbidden(message = "You do not have permission for this action.") {
  return new ApiError("FORBIDDEN", message, 403)
}

export function notFound(message = "Resource not found.") {
  return new ApiError("NOT_FOUND", message, 404)
}

export function conflict(message: string, details?: unknown) {
  return new ApiError("CONFLICT", message, 409, details)
}

export function validationError(message: string, details?: unknown) {
  return new ApiError("VALIDATION_ERROR", message, 422, details)
}

export function databaseError(message = "Database operation failed.", details?: unknown) {
  return new ApiError("DATABASE_ERROR", message, 500, details)
}
import { ZodError } from "zod"
