import "server-only"

import { Resend } from "resend"

import { getServerEnv } from "@/config/env"
import { logger } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import { measureAsync } from "@/lib/performance"
import { maskEmail } from "@/lib/security"
import type { Json } from "@/types/database"

export type ResendEmailInput = {
  to: string
  subject: string
  html: string
  text: string
  organizationId: string
  notificationId?: string
  idempotencyKey: string
  tags?: Record<string, string>
}

export type ResendEmailResult = {
  status: "sent" | "queued" | "failed"
  providerMessageId?: string | null
  responsePayload?: Json
  errorMessage?: string | null
}

export class ResendProvider {
  readonly providerName = "resend"

  async send(input: ResendEmailInput): Promise<ResendEmailResult> {
    const env = getServerEnv()

    if (!env.NOTIFICATIONS_SEND_ENABLED) {
      return {
        status: "queued",
        providerMessageId: null,
        responsePayload: {
          mode: "disabled",
          provider: this.providerName,
        },
      }
    }

    if (!env.RESEND_API_KEY) {
      return {
        status: "failed",
        errorMessage: "RESEND_API_KEY is not configured.",
      }
    }

    const resend = new Resend(env.RESEND_API_KEY)

    return measureAsync(
      {
        name: "resend_email_send",
        kind: "external",
        slowMs: 2000,
        tags: {
          organizationId: input.organizationId,
        },
      },
      async () => {
        logger.info({
          event: "email.resend.send_started",
          message: "Sending email through Resend.",
          organizationId: input.organizationId,
          metadata: {
            notificationId: input.notificationId,
            recipientEmail: maskEmail(input.to),
          },
        })

        const { data, error } = await resend.emails.send(
          {
            from: env.EMAIL_FROM,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            text: input.text,
            ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
            tags: Object.entries(input.tags ?? {}).map(([name, value]) => ({
              name,
              value: normalizeTagValue(value),
            })),
          },
          {
            idempotencyKey: input.idempotencyKey,
          }
        )

        if (error) {
          incrementMetric("email.failed", 1, {
            provider: this.providerName,
            organizationId: input.organizationId,
          })

          return {
            status: "failed",
            errorMessage: error.message,
            responsePayload: {
              provider: this.providerName,
              name: error.name,
              message: error.message,
            },
          }
        }

        incrementMetric("email.sent", 1, {
          provider: this.providerName,
          organizationId: input.organizationId,
        })

        return {
          status: "sent",
          providerMessageId: data?.id ?? null,
          responsePayload: {
            provider: this.providerName,
            message_id: data?.id ?? null,
          },
        }
      }
    )
  }
}

function normalizeTagValue(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256)
}
