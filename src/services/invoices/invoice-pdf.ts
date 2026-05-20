export type InvoicePdfRenderInput = {
  invoiceNumber: string
  organizationName: string
  residentName: string
  issueDate: string
  lineItems: Array<{
    description: string
    amount: number
  }>
  totals: {
    subtotalAmount: number
    discountAmount: number
    taxAmount: number
    totalAmount: number
  }
}

export type InvoicePdfRenderResult = {
  contentType: "application/pdf"
  fileName: string
  bytes: Uint8Array
}

export async function renderInvoicePdfPlaceholder(
  input: InvoicePdfRenderInput
): Promise<InvoicePdfRenderResult> {
  throw new Error(
    `PDF renderer is not configured for invoice ${input.invoiceNumber}. Add a server-side PDF provider before enabling downloads.`
  )
}
