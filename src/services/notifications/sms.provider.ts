import "server-only"

import type {
  NotificationProvider,
  NotificationSendInput,
  NotificationSendResult,
} from "./types"

export class SmsProvider implements NotificationProvider {
  readonly channel = "sms" as const
  readonly providerName = "sms-future-provider"

  async send(_input: NotificationSendInput): Promise<NotificationSendResult> {
    return {
      status: "queued",
      provider: this.providerName,
      responsePayload: {
        reason: "SMS provider is not configured yet.",
      },
    }
  }
}
