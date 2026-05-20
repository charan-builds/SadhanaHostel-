import type {
  HostelRow,
  InvoiceRow,
  MonthlyFeeRecordRow,
  OrganizationRow,
  ResidentRow,
} from "@/repositories/invoices.repository"

export type InvoiceLineItem = {
  description: string
  amount: number
}

export type InvoiceTemplateData = {
  organization: Pick<
    OrganizationRow,
    "name" | "legal_name" | "billing_email" | "contact_phone" | "address_line1" | "address_line2" | "city" | "state" | "postal_code"
  >
  hostel: Pick<HostelRow, "name" | "code" | "phone" | "email">
  resident: Pick<ResidentRow, "full_name" | "admission_number" | "phone" | "email">
  invoice: Pick<
    InvoiceRow,
    | "invoice_number"
    | "issue_date"
    | "due_date"
    | "subtotal_amount"
    | "discount_amount"
    | "tax_amount"
    | "total_amount"
    | "paid_amount"
    | "balance_amount"
    | "status"
  >
  lineItems: InvoiceLineItem[]
  footerNote: string
}

export function createMonthlyFeeInvoiceTemplateData(input: {
  organization: OrganizationRow
  hostel: HostelRow
  resident: ResidentRow
  invoice: InvoiceRow
  feeRecord: MonthlyFeeRecordRow
}): InvoiceTemplateData {
  const lineItems: InvoiceLineItem[] = [
    {
      description: `Monthly hostel fee - ${input.feeRecord.period_month}`,
      amount: input.feeRecord.base_amount,
    },
  ]

  if (input.feeRecord.penalty_amount > 0) {
    lineItems.push({
      description: "Penalty",
      amount: input.feeRecord.penalty_amount,
    })
  }

  if (input.feeRecord.adjustment_amount !== 0) {
    lineItems.push({
      description: "Manual adjustment",
      amount: input.feeRecord.adjustment_amount,
    })
  }

  if (input.feeRecord.advance_adjustment_amount > 0) {
    lineItems.push({
      description: "Advance adjustment",
      amount: -input.feeRecord.advance_adjustment_amount,
    })
  }

  if (input.feeRecord.discount_amount > 0) {
    lineItems.push({
      description: "Discount",
      amount: -input.feeRecord.discount_amount,
    })
  }

  return {
    organization: input.organization,
    hostel: input.hostel,
    resident: input.resident,
    invoice: input.invoice,
    lineItems,
    footerNote:
      "This is a system-generated invoice for hostel fee records. Please contact hostel administration for corrections.",
  }
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}
