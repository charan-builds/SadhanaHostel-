import "server-only"

import type {
  NotificationProvider,
  NotificationSendResult,
} from "./types"

export class WhatsappProvider implements NotificationProvider {
  readonly channel = "whatsapp" as const
  readonly providerName = "whatsapp-future-provider"

  async send(): Promise<NotificationSendResult> {
    return {
      status: "queued",
      provider: this.providerName,
      responsePayload: {
        reason: "WhatsApp provider is not configured yet.",
      },
    }
  }
}
