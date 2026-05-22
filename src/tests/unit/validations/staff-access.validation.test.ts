import { describe, expect, it } from "vitest"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import {
  createStaffUserSchema,
  updateStaffAccessSchema,
} from "@/validations/staff-access.validation"

describe("staff access validation", () => {
  it("validates admin-controlled staff invite creation", () => {
    const result = createStaffUserSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      fullName: "Finance Manager",
      email: "finance@sadhana.test",
      phone: "+919876543210",
      role: "finance",
      deliveryMode: "invite_link",
    })

    expect(result.role).toBe("finance")
    expect(result.deliveryMode).toBe("invite_link")
    expect(result.expiresInHours).toBe(72)
  })

  it("rejects resident role assignment through staff access", () => {
    const result = createStaffUserSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      fullName: "Resident Attempt",
      email: "resident@sadhana.test",
      role: "resident",
    })

    expect(result.success).toBe(false)
  })

  it("validates suspend and revoke style account transitions", () => {
    const result = updateStaffAccessSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      targetUserId: "00000000-0000-4000-8000-000000000601",
      status: "suspended",
    })

    expect(result.status).toBe("suspended")
  })
})
