"use client"

import { useMutation } from "@tanstack/react-query"

import { invoicesSdk } from "@/sdk"
import type { GenerateInvoiceInput, InvoiceDownloadInput } from "@/sdk/invoices.sdk"

export function useGenerateInvoice() {
  return useMutation({
    mutationFn: (input: GenerateInvoiceInput) => invoicesSdk.generate(input),
  })
}

export function useInvoiceDownloadUrl() {
  return useMutation({
    mutationFn: (input: InvoiceDownloadInput) => invoicesSdk.downloadUrl(input),
  })
}
