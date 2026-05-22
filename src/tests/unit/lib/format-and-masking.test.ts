import { describe, expect, it } from "vitest"

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  humanizeEnum,
} from "@/lib/format"
import {
  maskEmail,
  maskPhone,
  sanitizeNotificationText,
} from "@/lib/security/masking"

describe("formatting and masking helpers", () => {
  it("formats hostel UI values consistently", () => {
    expect(formatCurrency(12000)).toContain("12,000")
    expect(formatDate(null)).toBe("-")
    expect(formatDate("2026-05-22")).toContain("2026")
    expect(formatDateTime("2026-05-22T10:30:00.000Z")).toContain("2026")
    expect(humanizeEnum("verification_pending")).toBe("Verification Pending")
    expect(humanizeEnum(null)).toBe("-")
  })

  it("masks sensitive contact and document text", () => {
    expect(maskEmail("resident@example.com")).toBe("r******@example.com")
    expect(maskEmail(null)).toBeNull()
    expect(maskPhone("+91 98765 43210")).toBe("********3210")
    expect(maskPhone("123")).toBe("****")
    expect(sanitizeNotificationText("Aadhaar 123456789012 uploaded")).toBe(
      "Aadhaar ************ uploaded"
    )
  })
})
