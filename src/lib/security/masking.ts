const EMAIL_PATTERN = /^(.)(.*)(@.*)$/

export function maskEmail(email?: string | null) {
  if (!email) {
    return null
  }

  return email.replace(EMAIL_PATTERN, (_match, first: string, middle: string, domain: string) =>
    `${first}${"*".repeat(Math.min(middle.length, 6))}${domain}`
  )
}

export function maskPhone(phone?: string | null) {
  if (!phone) {
    return null
  }

  const digits = phone.replace(/\D/g, "")

  if (digits.length <= 4) {
    return "****"
  }

  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}

export function sanitizeNotificationText(value: string) {
  return value.replace(/\b\d{12}\b/g, "************").trim()
}
