import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("resident quick pay split", () => {
  it("adds Pay Fees navigation without removing Payment Center", () => {
    const navigation = readSource("src/constants/navigation.ts")

    expect(navigation).toContain('title: "Pay Fees"')
    expect(navigation).toContain('href: "/resident/pay-fees"')
    expect(navigation).toContain('title: "Payments"')
    expect(navigation).toContain('href: "/resident/payments"')
  })

  it("routes Pay Fees to the focused payment execution client", () => {
    const route = readSource("src/app/(resident)/resident/pay-fees/page.tsx")
    const quickPay = readSource("src/components/resident/resident-quick-pay-client.tsx")

    expect(route).toContain("ResidentQuickPayClient")
    expect(quickPay).toContain('title="Pay Fees"')
    expect(quickPay).toContain("Step 1")
    expect(quickPay).toContain("Enter Amount")
    expect(quickPay).toContain("Generate QR")
    expect(quickPay).toContain("Upload Proof")
    expect(quickPay).toContain("Submit Payment")
    expect(quickPay).toContain("Payment Submitted")
    expect(quickPay).toContain("Verification Pending")
    expect(quickPay).toContain("Expected Verification Window")
    expect(quickPay).toContain("View Status")
    expect(quickPay).toContain("useSubmitUpiPaymentWithProof")
  })

  it("keeps the Payments route informational instead of execution-first", () => {
    const paymentsRoute = readSource("src/app/(resident)/resident/payments/page.tsx")
    const paymentCenter = readSource("src/components/resident/resident-payment-center-client.tsx")

    expect(paymentsRoute).toContain("ResidentPaymentCenterClient")
    expect(paymentCenter).toContain('title="Payment Center"')
    expect(paymentCenter).toContain("Fee breakdown")
    expect(paymentCenter).toContain("Verification status")
    expect(paymentCenter).toContain("Invoices and receipts")
    expect(paymentCenter).toContain("Previous transactions")
    expect(paymentCenter).not.toContain("Generate QR")
    expect(paymentCenter).not.toContain("Upload Proof")
    expect(paymentCenter).not.toContain("Submit Payment")
  })

  it("routes dashboard fee actions directly to Quick Pay", () => {
    const dashboard = readSource("src/components/resident/resident-dashboard-client.tsx")
    const homeModel = readSource("src/lib/resident-experience/home.ts")

    expect(dashboard).toContain("ResidentFeeDueCard")
    expect(dashboard).toContain("Fee Due:")
    expect(dashboard).toContain("PAY NOW")
    expect(dashboard).toContain('href={"/resident/pay-fees"')
    expect(homeModel).toContain('href: "/resident/pay-fees"')
  })
})
