import { logger } from "./logger"

export function logRequestStart(metadata: {
  requestId: string
  route: string
  method: string
  path: string
  ip?: string | null
  requestSizeBytes?: number | null
}) {
  logger.info({
    event: "api.request.started",
    message: "API request started.",
    requestId: metadata.requestId,
    route: metadata.route,
    method: metadata.method,
    path: metadata.path,
    metadata: {
      ip: metadata.ip,
      requestSizeBytes: metadata.requestSizeBytes,
    },
  })
}

export function logRequestEnd(metadata: {
  requestId: string
  route: string
  method: string
  path: string
  status: number
  durationMs: number
}) {
  logger.info({
    event: "api.request.completed",
    message: "API request completed.",
    requestId: metadata.requestId,
    route: metadata.route,
    method: metadata.method,
    path: metadata.path,
    durationMs: metadata.durationMs,
    metadata: {
      status: metadata.status,
    },
  })
}
