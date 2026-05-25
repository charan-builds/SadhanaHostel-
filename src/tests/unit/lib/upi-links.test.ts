import { describe, expect, it } from "vitest"

import {
  buildHostelPaymentNote,
  buildHostelPaymentReference,
  buildUpiPaymentLink,
} from "@/lib/payments/upi-links"

describe("UPI payment links", () => {
  it("builds a standard UPI deep link with payee, amount, note, and reference", () => {
    const link = buildUpiPaymentLink({
      upiId: "sadhanahostel@ibl",
      payeeName: "Sadhana Boys Hostel",
      amount: 3500,
      transactionReference: "SBH-ADM001-ABC12345",
      note: "May hostel fee ADM001",
    })

    expect(link).toMatch(/^upi:\/\/pay\?/)
    expect(link).toContain("pa=sadhanahostel%40ibl")
    expect(link).toContain("pn=Sadhana+Boys+Hostel")
    expect(link).toContain("am=3500.00")
    expect(link).toContain("cu=INR")
    expect(link).toContain("tr=SBH-ADM001-ABC12345")
    expect(link).toContain("tn=May+hostel+fee+ADM001")
  })

  it("does not build unsafe links without UPI ID or positive amount", () => {
    expect(buildUpiPaymentLink({ upiId: "", amount: 3500 })).toBeNull()
    expect(buildUpiPaymentLink({ upiId: "hostel@ibl", amount: 0 })).toBeNull()
  })

  it("creates compact hostel references and notes for payment reconciliation", () => {
    const reference = buildHostelPaymentReference({
      admissionNumber: "ADM/2026-001",
      idempotencyKey: "7f8e9d0c-1111-2222-3333-444444444444",
    })
    const note = buildHostelPaymentNote({
      hostelName: "Sadhana Boys Hostel",
      residentName: "Charan",
      admissionNumber: "ADM/2026-001",
      reference,
    })

    expect(reference).toBe("SBH-ADM2026001-7F8E9D0C")
    expect(note).toContain("Sadhana Boys Hostel fee Charan")
    expect(note.length).toBeLessThanOrEqual(80)
  })
})
