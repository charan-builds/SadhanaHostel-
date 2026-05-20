import "server-only"

import { logger } from "@/lib/logger"
import { maskEmail, sanitizeNotificationText } from "@/lib/security"

import type {
  NotificationProvider,
  NotificationSendInput,
  NotificationSendResult,
} from "./types"

export class EmailProvider implements NotificationProvider {
  readonly channel = "email" as const
  readonly providerName = "internal-email-log"

  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    if (!input.recipient.email) {
      return {
        status: "failed",
        provider: this.providerName,
        errorMessage: "Recipient email is missing.",
      }
    }

    logger.info({
      event: "notification.email.prepared",
      message: "Email notification prepared for provider delivery.",
      organizationId: input.notification.organization_id,
      metadata: {
        notificationId: input.notification.id,
        recipientEmail: maskEmail(input.recipient.email),
        title: sanitizeNotificationText(input.notification.title),
      },
    })

    return {
      status: process.env.NOTIFICATIONS_SEND_ENABLED === "true" ? "sent" : "queued",
      provider: this.providerName,
      providerMessageId: null,
      responsePayload: {
        mode: process.env.NOTIFICATIONS_SEND_ENABLED === "true" ? "sent" : "queued",
      },
    }
  }
}
