import { afterEach, describe, expect, it, vi } from "vitest"

import * as supabaseAdmin from "@/lib/supabase/admin"
import { ResidentInvitesRepository } from "@/repositories/resident-invites.repository"
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

function createResidentDiagnosticDb(rows: Array<Record<string, unknown>>) {
  const result = { data: rows, error: null }
  const builder = {
    select: vi.fn(() => builder),
    is: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    then: vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
  }

  return {
    from: vi.fn(() => builder),
    builder,
  }
}

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
    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(
      createResidentDiagnosticDb([]) as never
    )
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

  it("resolves phone-first password login through the resident internal auth email alias", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid credentials" },
    })
    const authLoginEmail = "resident-00000000000040008000000000000088@auth.sadhanahostel.invalid"
    const adminDb = createResidentDiagnosticDb([
      {
        id: RESIDENT_USER_ID,
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        user_id: RESIDENT_USER_ID,
        status: "draft",
        onboarding_status: "activated",
        is_active: true,
        email: null,
        phone: "+91 90000 00002",
      },
    ])

    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(adminDb as never)
    vi.spyOn(UsersRepository.prototype, "getById").mockResolvedValue(
      userFixture({
        id: RESIDENT_USER_ID,
        email: null,
        phone: "+919000000002",
        default_role: "resident",
        metadata: {
          auth_login_email: authLoginEmail,
          internal_auth_email: authLoginEmail,
        },
      })
    )

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
      message:
        "Phone login could not be completed because resident password access is not synchronized. Ask hostel administration to reset resident access or run auth linkage repair.",
    })

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: authLoginEmail,
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
    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(
      createResidentDiagnosticDb([]) as never
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
    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(
      createResidentDiagnosticDb([]) as never
    )

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

  it("reports activation pending instead of invalid credentials for draft residents with active invites", async () => {
    const adminDb = createResidentDiagnosticDb([
      {
        id: RESIDENT_USER_ID,
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        user_id: null,
        status: "draft",
        onboarding_status: "invited",
        is_active: true,
        email: null,
        phone: "+91 90000 00002",
      },
    ])

    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(adminDb as never)
    vi.spyOn(ResidentInvitesRepository.prototype, "findActiveByResident").mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000089",
      organization_id: TEST_ORGANIZATION_ID,
      hostel_id: TEST_HOSTEL_ID,
      resident_id: RESIDENT_USER_ID,
      email: null,
      phone: "+91 90000 00002",
      invite_code: "SBH-ABCDEFGH",
      invite_token_hash: "hash",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: null,
      revoked_at: null,
      invited_by: null,
      status: "pending",
      metadata: {},
      created_at: "2026-05-26T00:00:00.000Z",
      updated_at: "2026-05-26T00:00:00.000Z",
      created_by: null,
      updated_by: null,
    })

    const service = new AuthService({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Invalid credentials" },
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
        "Activation is pending. Open the latest WhatsApp activation link or ask the hostel office to resend access.",
    })
  })

  it("reports expired invite recovery instead of invalid credentials for abandoned onboarding", async () => {
    const adminDb = createResidentDiagnosticDb([
      {
        id: RESIDENT_USER_ID,
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        user_id: null,
        status: "draft",
        onboarding_status: "invited",
        is_active: true,
        email: null,
        phone: "+91 90000 00002",
      },
    ])

    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(adminDb as never)
    vi.spyOn(ResidentInvitesRepository.prototype, "findActiveByResident").mockResolvedValue(null)
    vi.spyOn(ResidentInvitesRepository.prototype, "listForResident").mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000090",
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: RESIDENT_USER_ID,
        email: null,
        phone: "+91 90000 00002",
        invite_code: "SBH-EXPIRED1",
        invite_token_hash: "hash",
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        used_at: null,
        revoked_at: null,
        invited_by: null,
        status: "expired",
        metadata: {},
        created_at: "2026-05-26T00:00:00.000Z",
        updated_at: "2026-05-26T00:00:00.000Z",
        created_by: null,
        updated_by: null,
      },
    ])

    const service = new AuthService({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Invalid credentials" },
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
      message: "Your activation invite has expired. Ask hostel administration to resend resident access.",
    })
  })

  it("reports auth linkage repair when resident.user_id exists but public profile is missing", async () => {
    const adminDb = createResidentDiagnosticDb([
      {
        id: RESIDENT_USER_ID,
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        user_id: RESIDENT_USER_ID,
        status: "draft",
        onboarding_status: "activated",
        is_active: true,
        email: null,
        phone: "+91 90000 00002",
      },
    ])

    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(adminDb as never)
    vi.spyOn(UsersRepository.prototype, "getById").mockResolvedValue(null)

    const service = new AuthService({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Invalid credentials" },
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
        "Resident login is linked but profile synchronization is incomplete. Ask hostel administration to run auth linkage repair.",
    })
  })
})
