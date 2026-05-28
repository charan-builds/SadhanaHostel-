import { phoneDigits } from "@/lib/identity"

export function buildWhatsappUrl(input: {
  phone?: string | null
  message: string
}) {
  const phone = phoneDigits(input.phone)

  if (!phone) {
    return null
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(input.message)}`
}

export function buildPaymentSupportMessage(input: {
  residentName?: string | null
  admissionNumber?: string | null
  amount?: number | string | null
  reference?: string | null
  issue?: string | null
}) {
  return [
    "Hello, I need help with my hostel payment.",
    input.residentName ? `Resident: ${input.residentName}` : null,
    input.admissionNumber ? `Admission: ${input.admissionNumber}` : null,
    input.amount ? `Amount: ${input.amount}` : null,
    input.reference ? `Reference: ${input.reference}` : null,
    input.issue ? `Issue: ${input.issue}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}
