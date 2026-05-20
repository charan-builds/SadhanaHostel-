import "server-only"

import { timingSafeEqual } from "node:crypto"

import { unauthorized } from "@/lib/api/api-error"
import { logger } from "@/lib/logger"
import { getServerEnv } from "@/config/env"

export type CronAuthResult = {
  source: "vercel-cron" | "manual"
  userAgent: string | null
}

export function assertCronRequest(request: Request): CronAuthResult {
  const env = getServerEnv()

  if (!env.CRON_SECRET) {
    logger.error({
      event: "cron.auth.missing_secret",
      message: "Cron invocation denied because CRON_SECRET is not configured.",
    })
    throw unauthorized("Cron execution is not configured.")
  }

  const authHeader = request.headers.get("authorization")
  const expected = `Bearer ${env.CRON_SECRET}`

  if (!authHeader || !safeEqual(authHeader, expected)) {
    logger.warn({
      event: "cron.auth.denied",
      message: "Cron invocation denied.",
      metadata: {
        userAgent: request.headers.get("user-agent"),
      },
    })
    throw unauthorized("Invalid cron authorization.")
  }

  const userAgent = request.headers.get("user-agent")

  return {
    source: userAgent === "vercel-cron/1.0" ? "vercel-cron" : "manual",
    userAgent,
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}
