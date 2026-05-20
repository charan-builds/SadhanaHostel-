import { z } from "zod"

const uuidSchema = z.uuid()

export const generateInvoiceSchema = z.object({
  organizationId: uuidSchema,
  monthlyFeeRecordId: uuidSchema,
})

export const invoiceDownloadSchema = z.object({
  organizationId: uuidSchema,
  invoiceId: uuidSchema,
  expiresInSeconds: z.coerce.number().int().min(60).max(3600).default(900),
})
