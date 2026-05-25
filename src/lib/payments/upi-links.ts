export type UpiPaymentApp = "phonepe" | "gpay" | "paytm" | "bhim"

export const UPI_PAYMENT_APPS: Array<{
  id: UpiPaymentApp
  label: string
}> = [
  { id: "phonepe", label: "PhonePe" },
  { id: "gpay", label: "Google Pay" },
  { id: "paytm", label: "Paytm" },
  { id: "bhim", label: "BHIM" },
]

export type UpiPaymentLinkInput = {
  upiId?: string | null
  payeeName?: string | null
  amount?: number | string | null
  transactionReference?: string | null
  note?: string | null
}

export function buildUpiPaymentLink(input: UpiPaymentLinkInput) {
  const upiId = input.upiId?.trim()
  const amount = normalizeUpiAmount(input.amount)

  if (!upiId || !amount) {
    return null
  }

  const params = new URLSearchParams({
    pa: upiId,
    pn: trimUpiValue(input.payeeName ?? "Hostel Payment", 80),
    am: amount,
    cu: "INR",
  })
  const note = trimUpiValue(input.note, 80)
  const reference = trimUpiValue(input.transactionReference, 35)

  if (note) {
    params.set("tn", note)
  }

  if (reference) {
    params.set("tr", reference)
  }

  return `upi://pay?${params.toString()}`
}

export function buildHostelPaymentReference(input: {
  admissionNumber?: string | null
  idempotencyKey: string
}) {
  const admission = sanitizeReferencePart(input.admissionNumber || "RES")
  const suffix = sanitizeReferencePart(input.idempotencyKey).slice(0, 8)

  return `SBH-${admission}-${suffix}`.slice(0, 35)
}

export function buildHostelPaymentNote(input: {
  hostelName?: string | null
  residentName?: string | null
  admissionNumber?: string | null
  reference: string
  notes?: string | null
}) {
  const customNote = input.notes?.trim()

  if (customNote) {
    return trimUpiValue(customNote, 80)
  }

  return trimUpiValue(
    [
      input.hostelName || "Hostel",
      "fee",
      input.residentName,
      input.admissionNumber,
      input.reference,
    ]
      .filter(Boolean)
      .join(" "),
    80
  )
}

function normalizeUpiAmount(value: UpiPaymentLinkInput["amount"]) {
  const amount = typeof value === "string" ? Number(value) : value

  if (!amount || !Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return amount.toFixed(2)
}

function trimUpiValue(value: string | null | undefined, maxLength: number) {
  return value?.trim().replace(/\s+/g, " ").slice(0, maxLength) || ""
}

function sanitizeReferencePart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}
