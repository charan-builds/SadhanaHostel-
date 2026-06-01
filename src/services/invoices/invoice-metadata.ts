import type { Json } from "@/types/database"

export type InvoiceMetadataInput = {
  organizationId: string
  hostelId: string
  residentId: string
  periodMonth?: string
  generatedByUserId?: string | null
  source?: "monthly_fee" | "payment_receipt" | "manual" | "adjustment"
}

export function createInvoiceMetadata(input: InvoiceMetadataInput): Json {
  return {
    version: 1,
    source: input.source ?? "monthly_fee",
    organization_id: input.organizationId,
    hostel_id: input.hostelId,
    resident_id: input.residentId,
    period_month: input.periodMonth,
    generated_by_user_id: input.generatedByUserId,
    generated_at: new Date().toISOString(),
    pdf: {
      status: "pending",
    },
  }
}
