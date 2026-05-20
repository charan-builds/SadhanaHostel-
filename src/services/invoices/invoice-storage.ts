export type InvoiceStoragePathInput = {
  organizationId: string
  hostelId: string
  residentId: string
  invoiceNumber: string
}

export type InvoiceDownloadTokenInput = {
  invoiceId: string
  organizationId: string
  residentId: string
  expiresInSeconds: number
}

export function buildInvoiceStoragePath(input: InvoiceStoragePathInput) {
  const safeInvoiceNumber = input.invoiceNumber
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return [
    input.organizationId,
    input.hostelId,
    input.residentId,
    `${safeInvoiceNumber}.pdf`,
  ].join("/")
}

export function prepareInvoiceDownloadToken(input: InvoiceDownloadTokenInput) {
  return {
    tokenId: crypto.randomUUID(),
    invoiceId: input.invoiceId,
    organizationId: input.organizationId,
    residentId: input.residentId,
    expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
  }
}
