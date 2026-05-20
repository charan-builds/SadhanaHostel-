import "server-only"

import type {
  NotificationProvider,
  NotificationSendResult,
} from "./types"

export class InAppProvider implements NotificationProvider {
  readonly channel = "in_app" as const
  readonly providerName = "database-in-app"

  async send(): Promise<NotificationSendResult> {
    return {
      status: "sent",
      provider: this.providerName,
      responsePayload: {
        mode: "database",
      },
    }
  }
}
