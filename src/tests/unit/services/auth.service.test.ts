import { afterEach, describe, expect, it, vi } from "vitest"

import { ResidentsRepository } from "@/repositories/residents.repository"
import { UsersRepository } from "@/repositories/users.repository"
import { AuthService } from "@/services/auth.service"
import {
  RESIDENT_USER_ID,
  authUserFixture,
  residentFixture,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
  userFixture,
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
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it("continues draft residents to onboarding after temporary password login", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: {}, error: null })
    const signOut = vi.fn().mockResolvedValue({ data: {}, error: null })
    const authUser = authUserFixture({
      id: RESIDENT_USER_ID,
      email: undefined,
      phone: "+919000000002",
    })

    vi.spyOn(UsersRepository.prototype, "getById").mockResolvedValue(
      userFixture({
        id: RESIDENT_USER_ID,
        email: null,
        phone: "+919000000002",
        default_role: "resident",
        metadata: {
          temporary_password_active: true,
          temporary_password_expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    )
    vi.spyOn(UsersRepository.prototype, "getRoleAssignments").mockResolvedValue([
      userRoleFixture({
        user_id: RESIDENT_USER_ID,
        role: "resident",
      }),
    ])
    vi.spyOn(ResidentsRepository.prototype, "getByUserId").mockResolvedValue(
      residentFixture({
        user_id: RESIDENT_USER_ID,
        status: "draft",
        onboarding_status: "activated",
        email: null,
        phone: "+91 90000 00002",
      } as never)
    )

    const service = new AuthService({
      auth: {
        signInWithPassword,
        signOut,
        getUser: vi.fn().mockResolvedValue({
          data: { user: authUser },
          error: null,
        }),
      },
    } as never)

    await expect(
      service.login({
        identifier: "90000 00002",
        password: "Temporary123!",
      })
    ).resolves.toMatchObject({
      authenticated: true,
      onboardingRequired: true,
      redirectTo: "/resident/onboarding",
      roles: ["resident"],
    })

    expect(signOut).not.toHaveBeenCalled()
  })

  it("blocks expired temporary passwords before resident session reuse", async () => {
    const signOut = vi.fn().mockResolvedValue({ data: {}, error: null })

    vi.spyOn(UsersRepository.prototype, "getById").mockResolvedValue(
      userFixture({
        id: RESIDENT_USER_ID,
        default_role: "resident",
        metadata: {
          temporary_password_active: true,
          temporary_password_expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      })
    )
    vi.spyOn(UsersRepository.prototype, "getRoleAssignments").mockResolvedValue([
      userRoleFixture({
        user_id: RESIDENT_USER_ID,
        role: "resident",
      }),
    ])

    const service = new AuthService({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signOut,
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: authUserFixture({
              id: RESIDENT_USER_ID,
              email: undefined,
              phone: "+919000000002",
            }),
          },
          error: null,
        }),
      },
    } as never)

    await expect(
      service.login({
        identifier: "90000 00002",
        password: "Temporary123!",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message:
        "This temporary password has expired. Ask hostel administration to resend resident access.",
    })
    expect(signOut).toHaveBeenCalledOnce()
  })
})
