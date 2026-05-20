import "server-only"

import type {
  NotificationProvider,
  NotificationSendResult,
} from "./types"

export class SmsProvider implements NotificationProvider {
  readonly channel = "sms" as const
  readonly providerName = "sms-future-provider"

  async send(): Promise<NotificationSendResult> {
    return {
      status: "queued",
      provider: this.providerName,
      responsePayload: {
        reason: "SMS provider is not configured yet.",
      },
    }
  }
}
