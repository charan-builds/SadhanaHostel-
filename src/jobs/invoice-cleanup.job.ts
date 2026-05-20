import { InvoicesRepository } from "@/repositories/invoices.repository"

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
  async run(payload, context) {
    const invoicesRepository = new InvoicesRepository(context.db)
    const olderThan = new Date(Date.now() - payload.olderThanDays * 24 * 60 * 60 * 1000)
    const invoices = await invoicesRepository.listCancelledOlderThan(
      payload.organizationId,
      olderThan.toISOString()
    )
    const scopedInvoices = payload.hostelId
      ? invoices.filter((invoice) => invoice.hostel_id === payload.hostelId)
      : invoices

    return {
      status: "completed",
      processed: scopedInvoices.length,
      skipped: invoices.length - scopedInvoices.length,
      failed: 0,
      message:
        "Invoice cleanup scanned immutable invoice records. No invoice records were deleted.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        olderThanDays: payload.olderThanDays,
        scannedInvoiceIds: scopedInvoices.map((invoice) => invoice.id),
      },
    }
  },
}
