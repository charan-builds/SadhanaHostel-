export type InvoiceNumberInput = {
  organizationSlug: string
  sequence: number
  issueDate?: Date
}

export function createInvoiceNumber(input: InvoiceNumberInput) {
  const issueDate = input.issueDate ?? new Date()
  const year = issueDate.getUTCFullYear()
  const month = String(issueDate.getUTCMonth() + 1).padStart(2, "0")
  const prefix = sanitizeInvoicePrefix(input.organizationSlug)
  const sequence = String(input.sequence).padStart(6, "0")

  return `${prefix}-${year}${month}-${sequence}`
}

function sanitizeInvoicePrefix(value: string) {
  const prefix = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12)

  return prefix || "SBH"
}
