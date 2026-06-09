import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(path: string) {
  return readFileSync(join(root, path), "utf8")
}

describe("monthwise analytics platform wiring", () => {
  it("exposes the shared month selector and quick filters across analytics, reports, and payments", () => {
    const controls = source(
      "src/components/admin/analytics/monthwise-date-range-controls.tsx"
    )
    const ownerDashboard = source(
      "src/components/admin/analytics/owner-dashboard-client.tsx"
    )
    const reports = source("src/components/admin/reports/admin-reports-client.tsx")
    const payments = source("src/components/admin/payments/admin-payments-client.tsx")
    const rangeUtility = source("src/lib/monthwise-analytics.ts")

    expect(controls).toContain("Month Selector")
    expect(rangeUtility).toContain("This Month")
    expect(rangeUtility).toContain("Last Month")
    expect(rangeUtility).toContain("Last 3 Months")
    expect(rangeUtility).toContain("Last 6 Months")
    expect(rangeUtility).toContain("This Year")
    expect(rangeUtility).toContain("Custom Range")
    expect(ownerDashboard).toContain("MonthwiseDateRangeControls")
    expect(reports).toContain("MonthwiseDateRangeControls")
    expect(payments).toContain("MonthwiseDateRangeControls")
    expect(payments).toContain("dateBasis")
    expect(reports).toContain("dateBasis")
  })

  it("uses existing APIs and real historical data sources for owner monthwise metrics", () => {
    const service = source("src/services/analytics.service.ts")
    const repository = source("src/repositories/analytics.repository.ts")
    const ownerDashboard = source(
      "src/components/admin/analytics/owner-dashboard-client.tsx"
    )

    expect(ownerDashboard).toContain("MonthwiseHistoricalPanel")
    expect(service).toContain("listPaymentsInRange")
    expect(service).toContain("listOwnerFeeRecords")
    expect(service).toContain("listRoomAllocationsInRange")
    expect(service).toContain("listAdmissionLeadsInRange")
    expect(service).toContain("listSupportRequestsInRange")
    expect(service).toContain("listNoticeReadsInRange")
    expect(service).toContain("listNoticeAcknowledgementsInRange")
    expect(repository).toContain('.from("payments")')
    expect(repository).toContain('.from("monthly_fee_records")')
    expect(repository).toContain('.from("room_allocations")')
    expect(repository).toContain('.from("support_requests")')
    expect(repository).toContain('.from("notice_reads")')
    expect(ownerDashboard).toContain("Revenue")
    expect(ownerDashboard).toContain("Collections")
    expect(ownerDashboard).toContain("Outstanding dues")
    expect(ownerDashboard).toContain("Occupancy")
    expect(ownerDashboard).toContain("Admissions")
    expect(ownerDashboard).toContain("Complaints")
    expect(ownerDashboard).toContain("Notice engagement")
    expect(ownerDashboard).toContain("Resident activity")
    expect(service).not.toContain("fake")
    expect(service).not.toContain("sample")
  })

  it("keeps list drilldowns range-aware without adding duplicate endpoints", () => {
    const payments = source("src/validations/payment.validation.ts")
    const notices = source("src/validations/notice.validation.ts")
    const residents = source("src/validations/resident.validation.ts")
    const support = source("src/validations/support.validation.ts")
    const leaves = source("src/validations/leave.validation.ts")
    const appRoutes = source("src/app/api/v1/analytics/owner/route.ts")

    expect(payments).toContain("fromDate")
    expect(payments).toContain("toDate")
    expect(payments).toContain("dateBasis")
    expect(notices).toContain("fromDate")
    expect(residents).toContain("fromDate")
    expect(support).toContain("fromDate")
    expect(leaves).toContain("fromDate")
    expect(appRoutes).toContain("getOwnerDashboard")
  })
})
