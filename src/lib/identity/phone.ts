const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/

export class PhoneNormalizationError extends Error {
  constructor(message = "Enter a valid Indian mobile number.") {
    super(message)
    this.name = "PhoneNormalizationError"
  }
}

export function normalizePhoneNumber(value: string | null | undefined): string {
  const raw = value?.trim()

  if (!raw) {
    throw new PhoneNormalizationError("Phone number is required.")
  }

  if (/[^+\d\s().-]/.test(raw)) {
    throw new PhoneNormalizationError()
  }

  const digits = raw.replace(/\D/g, "")
  const mobile = extractIndianMobileDigits(raw, digits)

  if (!INDIAN_MOBILE_PATTERN.test(mobile)) {
    throw new PhoneNormalizationError()
  }

  return `+91${mobile}`
}

export function normalizeOptionalPhoneNumber(value: string | null | undefined) {
  if (!value?.trim()) {
    return undefined
  }

  return normalizePhoneNumber(value)
}

export function tryNormalizePhoneNumber(value: string | null | undefined) {
  try {
    return normalizeOptionalPhoneNumber(value) ?? null
  } catch {
    return null
  }
}

export function phoneNumbersMatch(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = tryNormalizePhoneNumber(left)
  const normalizedRight = tryNormalizePhoneNumber(right)

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

export function phoneDigits(value: string | null | undefined) {
  return tryNormalizePhoneNumber(value)?.replace(/\D/g, "") ?? null
}

export function phoneLastTen(value: string | null | undefined) {
  const digits = phoneDigits(value)

  return digits?.slice(-10) ?? null
}

function extractIndianMobileDigits(raw: string, digits: string) {
  if (raw.startsWith("+")) {
    if (!digits.startsWith("91") || digits.length !== 12) {
      throw new PhoneNormalizationError()
    }

    return digits.slice(2)
  }

  if (digits.startsWith("0091") && digits.length === 14) {
    return digits.slice(4)
  }

  if (digits.startsWith("91") && digits.length === 12) {
    return digits.slice(2)
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return digits.slice(1)
  }

  if (digits.length === 10) {
    return digits
  }

  throw new PhoneNormalizationError()
}
