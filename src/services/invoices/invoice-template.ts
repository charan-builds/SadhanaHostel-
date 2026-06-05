import type {
  HostelRow,
  InvoiceRow,
  MonthlyFeeRecordRow,
  OrganizationRow,
  ResidentRow,
} from "@/repositories/invoices.repository"
import type { PaymentRow } from "@/repositories/payments.repository"

export type InvoiceLineItem = {
  description: string
  amount: number
}

export type InvoiceTemplateData = {
  organization: Pick<
    OrganizationRow,
    "name" | "legal_name" | "billing_email" | "contact_phone" | "address_line1" | "address_line2" | "city" | "state" | "postal_code"
  >
  hostel: Pick<
    HostelRow,
    "name" | "code" | "phone" | "email" | "address_line1" | "address_line2" | "city" | "state" | "postal_code"
  >
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

export function createPaymentReceiptInvoiceTemplateData(input: {
  organization: OrganizationRow
  hostel: HostelRow
  resident: ResidentRow
  invoice: InvoiceRow
  payment: PaymentRow
}): InvoiceTemplateData {
  const reference =
    input.payment.transaction_id ??
    input.payment.manual_reference ??
    input.payment.id.slice(0, 8).toUpperCase()
  const paymentKind = input.payment.is_advance
    ? "Advance payment"
    : "Verified payment"

  return {
    organization: input.organization,
    hostel: input.hostel,
    resident: input.resident,
    invoice: input.invoice,
    lineItems: [
      {
        description: `${paymentKind} receipt - ${reference}`,
        amount: input.payment.amount,
      },
    ],
    footerNote:
      "This is a system-generated receipt for a verified hostel payment. Please contact hostel administration for corrections.",
  }
}

export function createGenericInvoiceTemplateData(input: {
  organization: OrganizationRow
  hostel: HostelRow
  resident: ResidentRow
  invoice: InvoiceRow
}): InvoiceTemplateData {
  return {
    organization: input.organization,
    hostel: input.hostel,
    resident: input.resident,
    invoice: input.invoice,
    lineItems: [
      {
        description: `Hostel invoice - ${input.invoice.invoice_number}`,
        amount: input.invoice.subtotal_amount,
      },
    ],
    footerNote:
      "This is a system-generated hostel invoice. Please contact hostel administration for corrections.",
  }
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}

export function getInvoiceHostelAddressLines(
  data: Pick<InvoiceTemplateData, "organization" | "hostel">
) {
  const hostelAddress = addressParts(data.hostel)
  const organizationAddress = addressParts(data.organization)
  const address = hostelAddress.length > 0 ? hostelAddress : organizationAddress

  return [data.hostel.name, address.join(", ")]
    .map((line) => normalizeSingleLine(line))
    .filter(Boolean)
}

export function getInvoiceHostelContactLine(
  data: Pick<InvoiceTemplateData, "organization" | "hostel">
) {
  const phone = firstPresent(data.hostel.phone, data.organization.contact_phone)
  const email = firstPresent(data.hostel.email, data.organization.billing_email)

  return [
    phone ? `Phone: ${phone}` : "",
    email ? `Email: ${email}` : "",
  ]
    .filter(Boolean)
    .join(" | ")
}

function addressParts(source: {
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}) {
  return [
    source.address_line1,
    source.address_line2,
    source.city,
    source.state,
    source.postal_code,
  ]
    .map((value) => normalizeSingleLine(value))
    .filter(Boolean)
}

function firstPresent(...values: Array<string | null | undefined>) {
  return values.map((value) => normalizeSingleLine(value)).find(Boolean) ?? ""
}

function normalizeSingleLine(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? ""
}
