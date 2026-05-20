import type { JobDefinition, OrganizationJobPayload } from "./types"

export type PaymentRemindersPayload = OrganizationJobPayload & {
  dueBeforeDate: string
}

export const paymentRemindersJob: JobDefinition<PaymentRemindersPayload> = {
  name: "payment_reminders",
  queueName: "notifications",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    [
      "payment_reminders",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      payload.dueBeforeDate,
    ].join(":"),
  async run(payload) {
    return {
      status: "skipped",
      processed: 0,
      skipped: 0,
      failed: 0,
      message:
        "Payment reminder dispatch is scaffolded. Add notification provider integration before enabling sends.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        dueBeforeDate: payload.dueBeforeDate,
      },
    }
  },
}
