import { describe, expect, it, vi } from "vitest"

import { AuthService } from "@/services/auth.service"
import {
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
  userRoleFixture,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

const OTHER_HOSTEL_ID = "00000000-0000-4000-8000-000000000099"

describe("AuthService tenant and hostel guards", () => {
  it("allows active role assignments for the requested hostel", () => {
    const service = new AuthService({} as never)

    expect(() =>
      service.requireHostelAccess(
        adminAuthContext({
          roleAssignments: [userRoleFixture({ hostel_id: TEST_HOSTEL_ID })],
          hostelIds: [TEST_HOSTEL_ID],
        }),
        TEST_ORGANIZATION_ID,
        TEST_HOSTEL_ID
      )
    ).not.toThrow()
  })

  it("rejects forged hostel identifiers inside an accessible organization", () => {
    const service = new AuthService({} as never)

    expect(() =>
      service.requireHostelAccess(
        adminAuthContext({
          roleAssignments: [userRoleFixture({ hostel_id: TEST_HOSTEL_ID })],
          hostelIds: [TEST_HOSTEL_ID],
        }),
        TEST_ORGANIZATION_ID,
        OTHER_HOSTEL_ID
      )
    ).toThrow("You cannot access data from another hostel.")
  })

  it("allows organization-wide active assignments to operate across hostels", () => {
    const service = new AuthService({} as never)

    expect(() =>
      service.requireHostelAccess(
        adminAuthContext({
          roleAssignments: [userRoleFixture({ hostel_id: null })],
          hostelIds: [TEST_HOSTEL_ID, OTHER_HOSTEL_ID],
        }),
        TEST_ORGANIZATION_ID,
        OTHER_HOSTEL_ID
      )
    ).not.toThrow()
  })
})

describe("AuthService resident phone-first access", () => {
  it("normalizes local resident phone numbers for password login", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid credentials" },
    })
    const service = new AuthService({
      auth: { signInWithPassword },
    } as never)

    await expect(
      service.login({
        identifier: "90000 00002",
        password: "Temporary123!",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid phone/email or password.",
    })

    expect(signInWithPassword).toHaveBeenCalledWith({
      phone: "+919000000002",
      password: "Temporary123!",
    })
  })

  it("requests resident OTP without creating unaudited auth accounts", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null })
    const service = new AuthService({
      auth: { signInWithOtp },
    } as never)

    await expect(
      service.requestResidentPhoneOtp({ phone: "90000 00002" })
    ).resolves.toEqual({
      phone: "********0002",
      expiresInSeconds: 300,
    })

    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: "+919000000002",
      options: { shouldCreateUser: false },
    })
  })
})
