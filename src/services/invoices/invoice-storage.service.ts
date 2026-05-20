import "server-only"

import { RepositoryError } from "@/repositories/types"
import type { AppSupabaseClient } from "@/repositories/types"

import type { GeneratedInvoicePdf } from "./invoice-pdf.service"

const INVOICE_BUCKET = "invoices"

export class InvoiceStorageService {
  constructor(private readonly db: AppSupabaseClient) {}

  async uploadInvoicePdf(storagePath: string, pdf: GeneratedInvoicePdf) {
    const arrayBuffer = pdf.bytes.buffer.slice(
      pdf.bytes.byteOffset,
      pdf.bytes.byteOffset + pdf.bytes.byteLength
    ) as ArrayBuffer
    const blob = new Blob([arrayBuffer], {
      type: pdf.contentType,
    })
    const { data, error } = await this.db.storage
      .from(INVOICE_BUCKET)
      .upload(storagePath, blob, {
        cacheControl: "31536000",
        contentType: pdf.contentType,
        upsert: false,
      })

    if (error) {
      throw new RepositoryError(error.message, "INVOICE_STORAGE_UPLOAD_FAILED", error)
    }

    return data
  }

  async createSignedDownloadUrl(storagePath: string, expiresInSeconds = 900) {
    const { data, error } = await this.db.storage
      .from(INVOICE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds)

    if (error) {
      throw new RepositoryError(error.message, "INVOICE_SIGNED_URL_FAILED", error)
    }

    return data
  }

  get bucketName() {
    return INVOICE_BUCKET
  }
}
