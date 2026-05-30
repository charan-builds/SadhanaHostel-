import { describe, expect, it } from "vitest"

import {
  anyRoleHasPermission,
  roleHasPermission,
  rolesForPermission,
} from "@/constants/auth"

describe("canonical role capability matrix", () => {
  it("keeps finance scoped to finance and analytics capabilities", () => {
    expect(roleHasPermission("finance", "finance.manage")).toBe(true)
    expect(roleHasPermission("finance", "payments.verify")).toBe(true)
    expect(roleHasPermission("finance", "residents.manage")).toBe(false)
    expect(roleHasPermission("finance", "rooms.manage")).toBe(false)
  })

  it("keeps receptionist and warden operational scopes distinct", () => {
    expect(roleHasPermission("receptionist", "admissions.manage")).toBe(true)
    expect(roleHasPermission("receptionist", "residents.manage")).toBe(true)
    expect(roleHasPermission("receptionist", "finance.manage")).toBe(false)
    expect(roleHasPermission("receptionist", "rooms.manage")).toBe(false)

    expect(roleHasPermission("warden", "rooms.manage")).toBe(true)
    expect(roleHasPermission("warden", "leaves.manage")).toBe(true)
    expect(roleHasPermission("warden", "finance.manage")).toBe(false)
  })

  it("keeps legacy staff away from room and finance controls", () => {
    expect(roleHasPermission("staff", "residents.manage")).toBe(true)
    expect(roleHasPermission("staff", "rooms.manage")).toBe(false)
    expect(roleHasPermission("staff", "finance.manage")).toBe(false)
  })

  it("resolves permission role lists deterministically", () => {
    expect(rolesForPermission("rooms.manage")).toEqual([
      "super_admin",
      "owner",
      "admin",
      "warden",
    ])
    expect(anyRoleHasPermission(["resident", "finance"], "payments.verify")).toBe(true)
    expect(anyRoleHasPermission(["resident", "staff"], "payments.verify")).toBe(false)
  })
})
