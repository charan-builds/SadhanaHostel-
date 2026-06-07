import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("resident mobile finance UX", () => {
  it("splits resident finance into mobile-first due and history tabs", () => {
    const source = readProjectFile("src/components/resident/resident-payments-client.tsx")

    expect(source).toContain("Due & Pay")
    expect(source).toContain("Payment History")
    expect(source).toContain('value="due"')
    expect(source).toContain('value="history"')
    expect(source).toContain("Pay Now")
    expect(source).toContain("Download Invoice")
    expect(source).toContain("Pay {formatCurrency(suggestedAmount)}")
  })

  it("reuses resident ledger without adding dashboard or notification fanout", () => {
    const source = readProjectFile("src/components/resident/resident-payments-client.tsx")

    expect(source).toContain("useResidentPaymentLedger")
    expect(source).not.toContain("useNotifications")
    expect(source).not.toMatch(/usePayments\(/)
    expect(source).not.toMatch(/useFinanceDashboard/)
    expect(source).not.toMatch(/useDashboardAnalytics/)
  })

  it("keeps expensive history, receipt drawer, and QR work lazy", () => {
    const source = readProjectFile("src/components/resident/resident-payments-client.tsx")

    expect(source).toContain('activeTab === "history"')
    expect(source).toContain("PaymentDetailDrawer")
    expect(source).toContain('void import("qrcode")')
    expect(source).not.toMatch(/import QRCode from "qrcode"/)
  })

  it("shows partial payment progress from the resident ledger record", () => {
    const source = readProjectFile("src/components/resident/resident-payments-client.tsx")

    expect(source).toContain("Partial payment progress")
    expect(source).toContain("record.paid_amount")
    expect(source).toContain("record.balance_amount")
  })
})

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
