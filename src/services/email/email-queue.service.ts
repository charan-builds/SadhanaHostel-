import "server-only"

import { logger } from "@/lib/logger"
import { sanitizeNotificationText } from "@/lib/security"
import type { Json } from "@/types/database"

import { EmailTemplateService } from "./email-template.service"
import { ResendProvider, type ResendEmailResult } from "./resend.provider"

export type SendTemplateEmailInput = {
  to: string
  title: string
  body: string
  templateKey?: string | null
  payload?: Json
  organizationId: string
  notificationId?: string
  idempotencyKey: string
}

export class EmailQueueService {
  private readonly templates = new EmailTemplateService()
  private readonly provider = new ResendProvider()

  async sendTemplate(input: SendTemplateEmailInput): Promise<ResendEmailResult> {
    const rendered = this.templates.render(input.templateKey, {
      title: sanitizeNotificationText(input.title),
      body: sanitizeNotificationText(input.body),
      payload: input.payload,
    })

    logger.info({
      event: "email.queue.dispatch",
      message: "Email dispatch prepared.",
      organizationId: input.organizationId,
      metadata: {
        notificationId: input.notificationId,
        templateKey: input.templateKey ?? "notification_generic",
      },
    })

    return this.provider.send({
      to: input.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      organizationId: input.organizationId,
      notificationId: input.notificationId,
      idempotencyKey: input.idempotencyKey,
      tags: {
        organization_id: input.organizationId,
        template_key: input.templateKey ?? "notification_generic",
      },
    })
  }
}
