import "server-only"

import type {
  NotificationProvider,
  NotificationSendInput,
  NotificationSendResult,
} from "./types"

export class WhatsappProvider implements NotificationProvider {
  readonly channel = "whatsapp" as const
  readonly providerName = "whatsapp-future-provider"

  async send(_input: NotificationSendInput): Promise<NotificationSendResult> {
    return {
      status: "queued",
      provider: this.providerName,
      responsePayload: {
        reason: "WhatsApp provider is not configured yet.",
      },
    }
  }
}
