export function buildWhatsappUrl(input: {
  phone?: string | null
  message: string
}) {
  const phone = input.phone?.replace(/\D/g, "")

  if (!phone) {
    return null
  }

  const normalizedPhone = phone.length === 10 ? `91${phone}` : phone

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(input.message)}`
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
