import { describe, expect, it } from "vitest"

import {
  normalizePhoneNumber,
  phoneDigits,
  phoneNumbersMatch,
  tryNormalizePhoneNumber,
} from "@/lib/identity"
import { phoneSchema } from "@/validations/common.validation"

describe("phone identity normalization", () => {
  it.each([
    ["9182732076", "+919182732076"],
    ["+91 91827 32076", "+919182732076"],
    ["91-91827-32076", "+919182732076"],
    ["09182732076", "+919182732076"],
    ["00919182732076", "+919182732076"],
  ])("normalizes %s into strict E.164", (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected)
    expect(phoneSchema.parse(input)).toBe(expected)
  })

  it("keeps WhatsApp/provider digits aligned with normalized phone", () => {
    expect(phoneDigits("90000 00002")).toBe("919000000002")
  })

  it("matches mixed phone formats by canonical value", () => {
    expect(phoneNumbersMatch("+91 90000 00002", "9000000002")).toBe(true)
    expect(phoneNumbersMatch("+91 90000 00002", "+91 80000 00002")).toBe(false)
  })

  it.each(["12345", "+1 555 111 2222", "5000000000", "phone-9000000002"])(
    "rejects malformed or non-Indian mobile number %s",
    (input) => {
      expect(() => normalizePhoneNumber(input)).toThrow(/valid Indian mobile/)
      expect(tryNormalizePhoneNumber(input)).toBeNull()
    }
  )
})
