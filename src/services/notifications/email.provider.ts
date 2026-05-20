import "server-only"

import { logger } from "@/lib/logger"
import { maskEmail, sanitizeNotificationText } from "@/lib/security"
import { EmailQueueService } from "@/services/email"

import type {
  NotificationProvider,
  NotificationSendInput,
  NotificationSendResult,
} from "./types"

export class EmailProvider implements NotificationProvider {
  readonly channel = "email" as const
  readonly providerName = "resend"
  private readonly emailQueue = new EmailQueueService()

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

    const result = await this.emailQueue.sendTemplate({
      to: input.recipient.email,
      title: input.notification.title,
      body: input.notification.body,
      templateKey: input.notification.template_key,
      payload: input.notification.payload,
      organizationId: input.notification.organization_id,
      notificationId: input.notification.id,
      idempotencyKey: `notification:${input.notification.id}`,
    })

    return {
      status: result.status,
      provider: this.providerName,
      providerMessageId: result.providerMessageId,
      responsePayload: result.responsePayload,
      errorMessage: result.errorMessage,
    }
  }
}
