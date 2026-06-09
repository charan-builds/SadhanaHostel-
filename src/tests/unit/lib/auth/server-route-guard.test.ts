import { describe, expect, it } from "vitest"

import { getAdminRouteRequiredPermission } from "@/lib/auth/server-route-guard"

describe("admin server route permission mapping", () => {
  it("requires dashboard permission for general admin shell surfaces", () => {
    expect(getAdminRouteRequiredPermission("/admin/dashboard")).toBe(
      "admin.dashboard.view"
    )
    expect(getAdminRouteRequiredPermission("/admin/notifications")).toBe(
      "admin.dashboard.view"
    )
  })

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
    expect(getAdminRouteRequiredPermission("/admin/alerts")).toBe("residents.manage")
    expect(getAdminRouteRequiredPermission("/admin/alerts?queue=visitor")).toBe(
      "residents.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/password-resets")).toBe(
      "residents.manage"
    )
  })

  it("protects operations center and sensitive operations routes", () => {
    expect(getAdminRouteRequiredPermission("/admin/operations")).toBe(
      "admin.dashboard.view"
    )
    expect(getAdminRouteRequiredPermission("/admin/operations/intelligence")).toBe(
      "admin.dashboard.view"
    )
    expect(getAdminRouteRequiredPermission("/admin/operations/automation")).toBe(
      "settings.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/operations/identity-repair")).toBe(
      "settings.manage"
    )
    expect(getAdminRouteRequiredPermission("/admin/operations/reset-demo-data")).toBe(
      "settings.manage"
    )
  })
})
