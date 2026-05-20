import { getServerEnv } from "@/config/env"
import { getRequestContext } from "@/lib/tracing"

export type LogLevel = "debug" | "info" | "warn" | "error"

export type StructuredLogEvent = {
  level: LogLevel
  message: string
  event: string
  timestamp?: string
  requestId?: string
  route?: string
  method?: string
  path?: string
  userId?: string | null
  organizationId?: string | null
  durationMs?: number
  metadata?: Record<string, unknown>
  error?: Record<string, unknown>
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const SENSITIVE_KEYS = [
  "password",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "service_role",
  "serviceRoleKey",
  "secret",
  "key",
]

function configuredLogLevel(): LogLevel {
  try {
    return getServerEnv().LOG_LEVEL
  } catch {
    return "info"
  }
}

function shouldLog(level: LogLevel) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configuredLogLevel()]
}

export function redactSensitiveData<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as T
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
      const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      )

      return [
        key,
        isSensitive ? "[REDACTED]" : redactSensitiveData(entryValue),
      ]
    })
  ) as T
}

export function writeStructuredLog(event: StructuredLogEvent) {
  if (!shouldLog(event.level)) {
    return
  }

  const context = getRequestContext()
  const payload = redactSensitiveData({
    timestamp: event.timestamp ?? new Date().toISOString(),
    requestId: event.requestId ?? context?.requestId,
    route: event.route ?? context?.route,
    method: event.method ?? context?.method,
    path: event.path ?? context?.path,
    userId: event.userId ?? context?.userId,
    organizationId: event.organizationId ?? context?.organizationId,
    ...event,
  })

  const line = `${JSON.stringify(payload)}\n`

  if (event.level === "error" || event.level === "warn") {
    process.stderr.write(line)
    return
  }

  process.stdout.write(line)
}

export const logger = {
  debug(event: Omit<StructuredLogEvent, "level">) {
    writeStructuredLog({ ...event, level: "debug" })
  },
  info(event: Omit<StructuredLogEvent, "level">) {
    writeStructuredLog({ ...event, level: "info" })
  },
  warn(event: Omit<StructuredLogEvent, "level">) {
    writeStructuredLog({ ...event, level: "warn" })
  },
  error(event: Omit<StructuredLogEvent, "level">) {
    writeStructuredLog({ ...event, level: "error" })
  },
}
