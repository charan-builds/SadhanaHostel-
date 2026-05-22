import { describe, expect, it } from "vitest"

import { ROLE_PERMISSIONS } from "@/constants/auth"

describe("RBAC permission boundaries", () => {
  it("keeps finance users out of IAM and platform settings", () => {
    expect(ROLE_PERMISSIONS.finance).toEqual(
      expect.arrayContaining(["finance.manage", "payments.verify", "reports.export"])
    )
    expect(ROLE_PERMISSIONS.finance).not.toContain("iam.manage")
    expect(ROLE_PERMISSIONS.finance).not.toContain("settings.manage")
    expect(ROLE_PERMISSIONS.finance).not.toContain("cms.manage")
  })

  it("keeps receptionist access scoped to admissions and resident intake", () => {
    expect(ROLE_PERMISSIONS.receptionist).toEqual(
      expect.arrayContaining(["admissions.manage", "residents.manage"])
    )
    expect(ROLE_PERMISSIONS.receptionist).not.toContain("finance.manage")
    expect(ROLE_PERMISSIONS.receptionist).not.toContain("payments.verify")
    expect(ROLE_PERMISSIONS.receptionist).not.toContain("iam.manage")
  })

  it("does not grant residents admin portal permissions", () => {
    expect(ROLE_PERMISSIONS.resident).toEqual([])
  })
})
