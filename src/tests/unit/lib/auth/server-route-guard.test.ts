import { describe, expect, it } from "vitest"

import { getAdminRouteRequiredPermission } from "@/lib/auth/server-route-guard"

describe("admin server route permission mapping", () => {
  it("requires finance permission for the finance module and payment operations", () => {
    expect(getAdminRouteRequiredPermission("/admin/finance")).toBe("finance.manage")
    expect(getAdminRouteRequiredPermission("/admin/finance?tab=intelligence")).toBe(
      "finance.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/finance/payment-security")).toBe(
      "finance.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/finance/collections")).toBe(
      "finance.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/finance/followups")).toBe(
      "finance.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/finance/receipts")).toBe(
      "finance.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/finance/reconciliation")).toBe(
      "finance.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/payments")).toBe("finance.manage")
  })

  it("keeps resident management on the residents permission boundary", () => {
    expect(getAdminRouteRequiredPermission("/admin/residents")).toBe("residents.manage")
    expect(getAdminRouteRequiredPermission("/admin/residents/resident-1")).toBe(
      "residents.manage"
    )
  })

  it("uses the dedicated owner and admin automation capability", () => {
    expect(
      getAdminRouteRequiredPermission("/admin/operations/automation")
    ).toBe("automation.manage")
  })
})
