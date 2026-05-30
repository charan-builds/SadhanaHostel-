import { AppError } from "@/lib/errors/app-error"

import { logger, type LogLevel } from "./logger"

export function serializeError(error: unknown) {
  if (error instanceof AppError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    }
  }

  return {
    message: "Unknown error",
    value: error,
  }
}

export function logError(error: unknown, metadata: Record<string, unknown> = {}) {
  const classification = classifyErrorLog(error, metadata)

  logger[classification.level]({
    event: classification.event,
    message: classification.message,
    requestId:
      typeof metadata.requestId === "string" ? metadata.requestId : undefined,
    error: serializeError(error),
    metadata,
  })
}

function classifyErrorLog(error: unknown, metadata: Record<string, unknown>): {
  level: LogLevel
  event: string
  message: string
} {
  const statusCode = resolveStatusCode(error, metadata)

  if (statusCode && statusCode < 500) {
    if (statusCode === 401 || statusCode === 403) {
      return {
        level: "warn",
        event: "application.auth_rejected",
        message: "Request rejected by auth guard.",
      }
    }

    if (statusCode === 429) {
      return {
        level: "warn",
        event: "application.rate_limited",
        message: "Request rate limited.",
      }
    }

    return {
      level: "info",
      event: "application.client_error",
      message: "Client request rejected.",
    }
  }

  return {
    level: "error",
    event: "application.error",
    message: "Application error occurred.",
  }
}

function resolveStatusCode(error: unknown, metadata: Record<string, unknown>) {
  if (typeof metadata.statusCode === "number") {
    return metadata.statusCode
  }

  if (error instanceof AppError) {
    return error.statusCode
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode
  }

  return undefined
}
