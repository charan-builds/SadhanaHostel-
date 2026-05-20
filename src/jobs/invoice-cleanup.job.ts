import type { JobDefinition, OrganizationJobPayload } from "./types"

export type InvoiceCleanupPayload = OrganizationJobPayload & {
  olderThanDays: number
}

export const invoiceCleanupJob: JobDefinition<InvoiceCleanupPayload> = {
  name: "invoice_cleanup",
  queueName: "maintenance",
  maxAttempts: 2,
  buildIdempotencyKey: (payload) =>
    [
      "invoice_cleanup",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      payload.olderThanDays,
    ].join(":"),
  async run(payload) {
    return {
      status: "skipped",
      processed: 0,
      skipped: 0,
      failed: 0,
      message:
        "Invoice cleanup is scaffolded. Keep immutable invoice records and only clean expired derived artifacts.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        olderThanDays: payload.olderThanDays,
      },
    }
  },
}
