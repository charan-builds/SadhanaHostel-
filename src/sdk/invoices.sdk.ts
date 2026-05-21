import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  generateInvoiceSchema,
  invoiceDownloadSchema,
} from "@/validations/invoice.validation"
import type { z } from "zod"

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>
export type InvoiceDownloadInput = z.infer<typeof invoiceDownloadSchema>

export type InvoiceDownloadUrl = {
  invoiceId: string
  invoiceNumber: string
  signedUrl: string
  downloadToken: string
}

export const invoicesSdk = {
  generate(input: GenerateInvoiceInput) {
    return apiClient.post<Tables<"invoices">, GenerateInvoiceInput>(
      "/api/v1/invoices/generate",
      input,
      { retry: 0 }
    )
  },

  downloadUrl(input: InvoiceDownloadInput) {
    const { invoiceId, ...query } = input

    return apiClient.get<InvoiceDownloadUrl>(
      `/api/v1/invoices/${invoiceId}/download`,
      query
    )
  },
}
