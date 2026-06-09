import { apiClient, buildApiUrl } from "@/lib/api-client"
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
  downloadUrl: string
}

export const invoicesSdk = {
  generate(input: GenerateInvoiceInput) {
    return apiClient.post<Tables<"invoices">, GenerateInvoiceInput>(
      "/api/v1/invoices/generate",
      input,
      { retry: 0 }
    )
  },

  async downloadUrl(input: InvoiceDownloadInput): Promise<InvoiceDownloadUrl> {
    const { invoiceId, ...query } = input
    const downloadUrl = buildApiUrl(`/api/v1/invoices/${invoiceId}/download`, query)

    return {
      invoiceId,
      downloadUrl,
    }
  },
}
