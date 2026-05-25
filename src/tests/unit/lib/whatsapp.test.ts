import { describe, expect, it } from "vitest"

import {
  buildPaymentSupportMessage,
  buildWhatsappUrl,
} from "@/lib/operations/whatsapp"

describe("WhatsApp operational links", () => {
  it("normalizes Indian 10 digit numbers and encodes operational messages", () => {
    const url = buildWhatsappUrl({
      phone: "93461 31788",
      message: "Hello finance\nPayment help",
    })

    expect(url).toBe(
      "https://wa.me/919346131788?text=Hello%20finance%0APayment%20help"
    )
  })

  it("builds resident payment support messages with reconciliation context", () => {
    const message = buildPaymentSupportMessage({
      residentName: "Charan",
      admissionNumber: "ADM001",
      amount: 3500,
      reference: "SBH-ADM001-ABC12345",
      issue: "Payment was rejected.",
    })

    expect(message).toContain("Resident: Charan")
    expect(message).toContain("Admission: ADM001")
    expect(message).toContain("Reference: SBH-ADM001-ABC12345")
    expect(message).toContain("Payment was rejected.")
  })
})
