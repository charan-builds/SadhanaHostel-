import { AppError } from "@/lib/errors/app-error"

import { logger } from "./logger"

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
  logger.error({
    event: "application.error",
    message: "Application error occurred.",
    requestId:
      typeof metadata.requestId === "string" ? metadata.requestId : undefined,
    error: serializeError(error),
    metadata,
  })
}
