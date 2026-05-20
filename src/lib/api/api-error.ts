import { ZodError } from "zod"

import {
  AppError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationAppError,
} from "@/lib/errors"

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
  requestId?: string
  details?: unknown
}

export class ApiError extends Error {
  readonly code: ApiErrorCode | string
  readonly statusCode: number
  readonly details?: unknown
  readonly expose: boolean

  constructor(
    code: ApiErrorCode | string,
    message: string,
    statusCode = 500,
    details?: unknown,
    expose = statusCode < 500
  ) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.expose = expose
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof ZodError) {
    return validationError("Validation failed.", error.flatten())
  }

  if (error instanceof AppError) {
    return new ApiError(
      error.code,
      error.expose ? error.message : "An unexpected error occurred.",
      error.statusCode,
      error.expose ? error.details : undefined,
      error.expose
    )
  }

  if (isRepositoryError(error)) {
    const code = error.code ?? "DATABASE_ERROR"
    const isStorageError = code.includes("STORAGE") || code.includes("SIGNED_URL")

    return new ApiError(
      code,
      isStorageError ? "Storage operation failed." : "Database operation failed.",
      500,
      undefined,
      false
    )
  }

  if (error instanceof Error) {
    return new ApiError(
      "INTERNAL_ERROR",
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred."
        : error.message,
      500,
      undefined,
      false
    )
  }

  return new ApiError(
    "INTERNAL_ERROR",
    "An unexpected error occurred.",
    500,
    undefined,
    false
  )
}

export function badRequest(message: string, details?: unknown) {
  return new ApiError("BAD_REQUEST", message, 400, details)
}

export function unauthorized(message = "Authentication is required.") {
  return new AuthError(message)
}

export function forbidden(message = "You do not have permission for this action.") {
  return new ForbiddenError(message)
}

export function notFound(message = "Resource not found.") {
  return new NotFoundError(message)
}

export function conflict(message: string, details?: unknown) {
  return new ApiError("CONFLICT", message, 409, details)
}

export function validationError(message: string, details?: unknown) {
  return new ValidationAppError(message, details)
}

export function databaseError(message = "Database operation failed.", details?: unknown) {
  return new ApiError("DATABASE_ERROR", message, 500, details, false)
}

function isRepositoryError(error: unknown): error is { name: string; code?: string } {
  return (
    error instanceof Error &&
    error.name === "RepositoryError" &&
    ("code" in error ? typeof error.code === "string" : true)
  )
}
