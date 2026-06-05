import { describe, expect, it } from "vitest"

import {
  buildCollectionKpis,
  buildCollectionSections,
  filterCollectionRows,
} from "@/lib/finance/collection-center"
import type {
  FinanceDashboard,
  ResidentFinanceSummary,
} from "@/lib/finance/finance-dashboard"
import { residentFixture } from "@/tests/fixtures"

describe("collection center helpers", () => {
  it("builds owner-facing collection KPI cards from aggregate dashboard data", () => {
    const dashboard = {
      owner: {
        summary: {
          todayRevenue: 4_000,
        },
      },
      kpis: {
        collectedAmount: 82_000,
        pendingAmount: 18_000,
        overdueAmount: 7_500,
        collectionRate: 82,
        averageCollectionDelay: 3,
        residentsDueToday: 6,
      },
      dueWindows: {
        today: 9_000,
        todayCount: 6,
        week: 22_000,
        weekCount: 12,
        month: 60_000,
        monthCount: 28,
      },
    } as FinanceDashboard

    expect(buildCollectionKpis(dashboard)).toEqual({
      todayCollection: 4_000,
      monthCollection: 82_000,
      pendingCollection: 18_000,
      overdueCollection: 7_500,
      dueToday: 9_000,
      dueThisWeek: 13_000,
      collectionRate: 82,
      averageCollectionDelay: 3,
      residentsDueToday: 6,
    })
  })

  it("segments collection rows into due today, weekly due, overdue, upcoming, and high risk queues", () => {
    const rows = [
      collectionRow({
        resident: residentFixture({ id: "resident-due-today", full_name: "Due Today" }),
        primaryDueDate: "2026-06-05",
      }),
      collectionRow({
        resident: residentFixture({ id: "resident-overdue", full_name: "Overdue" }),
        overdueAmount: 3_500,
        daysOverdue: 12,
        primaryDueDate: "2026-05-24",
      }),
      collectionRow({
        resident: residentFixture({ id: "resident-upcoming", full_name: "Upcoming" }),
        primaryDueDate: "2026-06-20",
      }),
      collectionRow({
        resident: residentFixture({ id: "resident-week", full_name: "Week" }),
        primaryDueDate: "2026-06-10",
      }),
      collectionRow({
        resident: residentFixture({ id: "resident-risk", full_name: "Risk" }),
        priority: "high",
        riskScore: 74,
      }),
    ]

    const sections = buildCollectionSections(rows, "2026-06-05")

    expect(sections.find((section) => section.key === "dueToday")?.rows).toEqual([
      rows[0],
    ])
    expect(sections.find((section) => section.key === "overdue")?.rows).toEqual([
      rows[1],
    ])
    expect(sections.find((section) => section.key === "upcomingDues")?.rows).toEqual([
      rows[2],
      rows[3],
    ])
    expect(sections.find((section) => section.key === "dueThisWeek")?.rows).toEqual([
      rows[3],
    ])
    expect(sections.find((section) => section.key === "highRisk")?.rows).toEqual([
      rows[4],
    ])
  })

  it("filters the global finance search locally across resident, invoice, receipt, and payment tokens", () => {
    const rows = [
      collectionRow({
        resident: residentFixture({
          id: "resident-charan",
          full_name: "Charan Kumar",
          admission_number: "SBH-2026-001",
          phone: "+91 98490 84940",
        }),
        invoiceNumbers: ["INV-2026-00012"],
        receiptNumbers: ["RCT-2026-00012"],
        transactionIds: ["UPI-TXN-042"],
      }),
      collectionRow({
        resident: residentFixture({
          id: "resident-naveen",
          full_name: "Naveen Kumar",
          admission_number: "SBH-2026-002",
          phone: "+91 90000 00000",
        }),
        invoiceNumbers: ["INV-2026-00013"],
      }),
    ]

    expect(filterCollectionRows(rows, "98490")).toEqual([rows[0]])
    expect(filterCollectionRows(rows, "INV-2026-00013")).toEqual([rows[1]])
    expect(filterCollectionRows(rows, "rct-2026-00012")).toEqual([rows[0]])
    expect(filterCollectionRows(rows, "upi-txn-042")).toEqual([rows[0]])
    expect(filterCollectionRows(rows, "SBH-2026-001")).toEqual([rows[0]])
  })

  it("keeps local collection search under the owner workflow latency target", () => {
    const rows = Array.from({ length: 5_000 }, (_, index) =>
      collectionRow({
        resident: residentFixture({
          id: `resident-${index}`,
          full_name: `Resident ${index}`,
          admission_number: `SBH-LOAD-${index}`,
          phone: `+91 90000 ${String(index).padStart(5, "0")}`,
        }),
        invoiceNumbers: [`INV-LOAD-${index}`],
        transactionIds: [`TXN-LOAD-${index}`],
      })
    )

    const startedAt = performance.now()
    const result = filterCollectionRows(rows, "TXN-LOAD-4999")
    const elapsedMs = performance.now() - startedAt

    expect(result).toHaveLength(1)
    expect(result[0]?.resident.admission_number).toBe("SBH-LOAD-4999")
    expect(elapsedMs).toBeLessThan(150)
  })
})

function collectionRow(
  overrides: Partial<ResidentFinanceSummary> = {}
): ResidentFinanceSummary {
  const resident = overrides.resident ?? residentFixture()
  const invoiceNumbers = overrides.invoiceNumbers ?? []
  const receiptNumbers = overrides.receiptNumbers ?? []
  const transactionIds = overrides.transactionIds ?? []
  const searchIndex =
    overrides.searchIndex ??
    [
      resident.full_name,
      resident.admission_number,
      resident.phone,
      resident.email,
      ...invoiceNumbers,
      ...receiptNumbers,
      ...transactionIds,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

  return {
    resident,
    monthlyFee: resident.monthly_fee_amount,
    currentDue: 0,
    overdueAmount: 0,
    advanceBalance: 0,
    lastPaymentDate: null,
    lastPaymentAmount: 0,
    averageDelayDays: 0,
    onTimeRate: 0,
    latePayments: 0,
    partialPayments: 0,
    failedPayments: 0,
    collectionScore: 90,
    riskScore: 10,
    priority: "low",
    daysOverdue: 0,
    hasVerifiedPaymentThisMonth: false,
    primaryDueRecordId: null,
    primaryDueBalance: 0,
    primaryDueDate: null,
    nextDueDate: null,
    invoiceNumbers,
    receiptNumbers,
    transactionIds,
    searchIndex,
    ...overrides,
  }
}
