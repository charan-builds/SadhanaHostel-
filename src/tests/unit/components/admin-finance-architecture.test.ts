import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("admin finance dashboard architecture", () => {
  it("uses the single finance dashboard query instead of per-resident ledger fanout", () => {
    const source = readProjectFile("src/components/admin/finance/admin-finance-client.tsx")

    expect(source).toContain("useFinanceDashboard")
    expect(source).not.toMatch(/useResidentPaymentLedgers/)
    expect(source).not.toMatch(/useResidents\(/)
    expect(source).not.toMatch(/usePayments\(/)
    expect(source).not.toMatch(/useOwnerAnalytics\(/)
    expect(source).not.toMatch(/useDashboardAnalytics\(/)
  })

  it("keeps owner collection workflows inside Finance", () => {
    const source = readProjectFile("src/components/admin/finance/admin-finance-client.tsx")

    expect(source).toContain("Record Cash Collection")
    expect(source).toContain("CashCollectionDialog")
    expect(source).toContain("useRecordInPersonPayment")
    expect(source).toContain("row.searchIndex")
    expect(source).toContain("Collections Today")
    expect(source).toContain("Upcoming Dues")
    expect(source).toContain("High Risk Residents")
    expect(source).toContain("groupTimelineEvents")
    expect(source).toContain("timelineEventMeta")
  })

  it("exposes the operational finance workspace sections from the admin sidebar", () => {
    const source = readProjectFile("src/components/admin/layout/admin-sidebar.tsx")

    expect(source).toContain("Dashboard")
    expect(source).toContain("Collections")
    expect(source).toContain("Followups")
    expect(source).toContain("Receipts")
    expect(source).toContain("Reconciliation")
    expect(source).toContain("/admin/finance/collections")
    expect(source).toContain("/admin/finance/followups")
    expect(source).toContain("/admin/finance/receipts")
    expect(source).toContain("/admin/finance/reconciliation")
  })

  it("keeps the collections page aggregate-first with drawer-only ledger loading", () => {
    const source = readProjectFile("src/components/admin/finance/admin-collections-client.tsx")

    expect(source).toContain("useFinanceDashboard")
    expect(source).toContain("filterCollectionRows")
    expect(source).toContain("useRecordInPersonPayment")
    expect(source).toContain("CollectionLedgerDrawer")
    expect(source).toContain("useResidentPaymentLedger")
    expect(source).toContain("Search Results")
    expect(source).toContain("Today's Collections")
    expect(source).toContain("Pending Collections")
    expect(source).toContain("Overdue Collections")
    expect(source).toContain("Due Today")
    expect(source).toContain("Due This Week")
    expect(source).toContain("Reference number")
    expect(source).toContain("Bank Transfer")
    expect(source).toContain("Receipt and invoice links are ready")
    expect(source).not.toMatch(/useResidentPaymentLedgers/)
    expect(source).not.toMatch(/useResidents\(/)
    expect(source).not.toMatch(/usePayments\(/)
    expect(source).not.toMatch(/useOwnerAnalytics\(/)
    expect(source).not.toMatch(/useDashboardAnalytics\(/)
  })

  it("refreshes finance and notification queries after counter collections", () => {
    const source = readProjectFile("src/hooks/use-payments.ts")

    expect(source).toContain("refetchType: \"active\"")
    expect(source).toContain("queryKeys.finance.all")
    expect(source).toContain("queryKeys.notifications.all")
  })

  it("keeps finance reconciliation actions dry-run by default in the workspace", () => {
    const source = readProjectFile(
      "src/components/admin/finance/admin-reconciliation-client.tsx"
    )

    expect(source).toContain("useRepairFinancialReconciliation")
    expect(source).toContain("useRegenerateMissingReceipts")
    expect(source).toContain("dryRun: true")
    expect(source).not.toContain("dryRun: false")
  })

  it("uses real notification center hooks in the admin topbar", () => {
    const source = readProjectFile("src/components/admin/layout/admin-topbar.tsx")

    expect(source).toContain("useNotifications")
    expect(source).toContain("useMarkNotificationRead")
    expect(source).toContain("useMarkAllNotificationsRead")
    expect(source).toContain("Mark All Read")
    expect(source).toContain("unreadCount")
  })

  it("keeps website CMS editing form-based instead of raw JSON-based", () => {
    const source = readProjectFile("src/components/admin/website/admin-website-client.tsx")

    expect(source).toContain("buildSettingContent")
    expect(source).toContain("sectionFields")
    expect(source).not.toContain("contentJson")
    expect(source).not.toContain("Content JSON")
    expect(source).not.toContain("JSON.parse(values")
  })

  it("opens invoice downloads through authenticated app endpoints", () => {
    const sdkSource = readProjectFile("src/sdk/invoices.sdk.ts")
    const routeSource = readProjectFile("src/app/api/v1/invoices/[id]/download/route.ts")

    expect(sdkSource).toContain("buildApiUrl(`/api/v1/invoices/${invoiceId}/download`, query)")
    expect(routeSource).toContain("downloadInvoicePdf")
    expect(routeSource).toContain("\"content-disposition\"")
  })
})

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
