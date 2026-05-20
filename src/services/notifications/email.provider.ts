import "server-only"

import { getServerEnv } from "@/config/env"
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
    const sendEnabled = getServerEnv().NOTIFICATIONS_SEND_ENABLED

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
      status: sendEnabled ? "sent" : "queued",
      provider: this.providerName,
      providerMessageId: null,
      responsePayload: {
        mode: sendEnabled ? "sent" : "queued",
      },
    }
  }
}
