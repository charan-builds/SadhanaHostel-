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

function createResidentDiagnosticDb(
  rows: Array<Record<string, unknown>>,
  extras: Record<string, unknown> = {}
) {
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
    ...extras,
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

describe("AuthService permission guards", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("allows a role with the requested capability", async () => {
    const service = new AuthService({} as never)
    vi.spyOn(service, "getCurrentContext").mockResolvedValue(
      adminAuthContext({
        roles: ["finance"],
        primaryRole: "finance",
      })
    )

    await expect(service.requirePermission("finance.manage")).resolves.toMatchObject({
      primaryRole: "finance",
    })
  })

  it("rejects a role without the requested capability", async () => {
    const service = new AuthService({} as never)
    vi.spyOn(service, "getCurrentContext").mockResolvedValue(
      adminAuthContext({
        roles: ["staff"],
        primaryRole: "staff",
      })
    )

    await expect(service.requirePermission("rooms.manage")).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })

  it("does not retain a stale privileged default_role when active role assignments exist", () => {
    const service = new AuthService({} as never)
    const roles = (
      service as unknown as {
        resolveRoles(
          profile: ReturnType<typeof userFixture>,
          roleAssignments: ReturnType<typeof userRoleFixture>[]
        ): string[]
      }
    ).resolveRoles(
      userFixture({ default_role: "admin" }),
      [
        userRoleFixture({
          role: "receptionist",
          status: "active",
        }),
        userRoleFixture({
          id: "00000000-0000-4000-8000-000000000031",
          role: "admin",
          status: "suspended",
        }),
      ]
    )

    expect(roles).toEqual(["receptionist"])
  })

  it("keeps default_role as a legacy fallback when no active assignments exist", () => {
    const service = new AuthService({} as never)
    const roles = (
      service as unknown as {
        resolveRoles(
          profile: ReturnType<typeof userFixture>,
          roleAssignments: ReturnType<typeof userRoleFixture>[]
        ): string[]
      }
    ).resolveRoles(userFixture({ default_role: "owner" }), [])

    expect(roles).toEqual(["owner"])
  })

  it("blocks expired staff temporary passwords marked by force_password_reset", async () => {
    const signOut = vi.fn().mockResolvedValue({ data: {}, error: null })
    const service = new AuthService({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signOut,
        getUser: vi.fn().mockResolvedValue({
          data: { user: authUserFixture() },
          error: null,
        }),
      },
    } as never)

    vi.spyOn(UsersRepository.prototype, "getById").mockResolvedValue(
      userFixture({
        default_role: "admin",
        metadata: {
          force_password_reset: true,
          temporary_password_expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      })
    )
    vi.spyOn(UsersRepository.prototype, "getRoleAssignments").mockResolvedValue([
      userRoleFixture({ role: "admin" }),
    ])

    await expect(
      service.login({
        identifier: "admin.test@sadhanahostel.example",
        password: "Temporary123!",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message:
        "This temporary password has expired. Ask hostel administration to resend resident access.",
    })
    expect(signOut).toHaveBeenCalledOnce()
  })

  it("rejects password reset redirects outside the configured app origin", async () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sadhanahostel.example"
    const resetPasswordForEmail = vi.fn()
    const service = new AuthService({
      auth: { resetPasswordForEmail },
    } as never)

    await expect(
      service.resetPassword({
        email: "admin.test@sadhanahostel.example",
        redirectTo: "https://evil.example/login",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Password reset redirect URL is not allowed.",
    })
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })

  it("allows password reset redirects to known same-origin auth paths", async () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sadhanahostel.example"
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null })
    const service = new AuthService({
      auth: { resetPasswordForEmail },
    } as never)

    await expect(
      service.resetPassword({
        email: "admin.test@sadhanahostel.example",
        redirectTo: "https://app.sadhanahostel.example/reset-password",
      })
    ).resolves.toEqual({ email: "admin.test@sadhanahostel.example" })
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "admin.test@sadhanahostel.example",
      { redirectTo: "https://app.sadhanahostel.example/reset-password" }
    )
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
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
    const authLoginEmail = "resident-00000000000040008000000000000012@auth.sadhanahostel.invalid"
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
      message: "Invalid phone/email or password.",
    })

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: authLoginEmail,
      password: "Temporary123!",
    })
  })

  it("repairs a missing public alias from Supabase auth metadata before phone password login", async () => {
    const authLoginEmail = "resident-00000000000040008000000000000012@auth.sadhanahostel.invalid"
    const updateUserById = vi.fn().mockResolvedValue({
      data: {
        user: authUserFixture({
          id: RESIDENT_USER_ID,
          email: authLoginEmail,
          phone: "+919000000002",
          user_metadata: {
            organization_id: TEST_ORGANIZATION_ID,
            hostel_id: TEST_HOSTEL_ID,
            resident_id: RESIDENT_USER_ID,
            auth_login_email: authLoginEmail,
            internal_auth_email: authLoginEmail,
          },
        } as never),
      },
      error: null,
    })
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    const adminDb = createResidentDiagnosticDb(
      [
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
      ],
      {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: {
                user: authUserFixture({
                  id: RESIDENT_USER_ID,
                  email: authLoginEmail,
                  phone: "+919000000002",
                  user_metadata: {
                    organization_id: TEST_ORGANIZATION_ID,
                    hostel_id: TEST_HOSTEL_ID,
                    resident_id: RESIDENT_USER_ID,
                    auth_login_email: authLoginEmail,
                    internal_auth_email: authLoginEmail,
                  },
                } as never),
              },
              error: null,
            }),
            updateUserById,
          },
        },
        rpc,
      }
    )

    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(adminDb as never)
    vi.spyOn(UsersRepository.prototype, "getById").mockResolvedValue(
      userFixture({
        id: RESIDENT_USER_ID,
        email: null,
        phone: "+919000000002",
        default_role: "resident",
        metadata: {},
      })
    )

    const service = new AuthService({} as never)
    const credentials = await (
      service as unknown as {
        buildPasswordCredentialsForLogin(identifier: string, password: string): Promise<unknown>
      }
    ).buildPasswordCredentialsForLogin("90000 00002", "Temporary123!")

    expect(credentials).toEqual({
      email: authLoginEmail,
      password: "Temporary123!",
    })
    expect(updateUserById).toHaveBeenCalledWith(
      RESIDENT_USER_ID,
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          auth_login_email: authLoginEmail,
          internal_auth_email: authLoginEmail,
          resident_auth_identity_version: 2,
        }),
      })
    )
    expect(rpc).toHaveBeenCalledWith("repair_resident_auth_identity_atomic", {
      p_organization_id: TEST_ORGANIZATION_ID,
      p_resident_id: RESIDENT_USER_ID,
      p_auth_user_id: RESIDENT_USER_ID,
      p_auth_login_email: authLoginEmail,
      p_internal_auth_email: authLoginEmail,
      p_reason: "login_alias_metadata_missing",
    })
  })

  it("recreates the deterministic internal alias when a linked phone auth user lost email metadata", async () => {
    const authLoginEmail = "resident-00000000000040008000000000000012@auth.sadhanahostel.invalid"
    const updateUserById = vi.fn().mockResolvedValue({
      data: {
        user: authUserFixture({
          id: RESIDENT_USER_ID,
          email: authLoginEmail,
          phone: "+919000000002",
          user_metadata: {
            auth_login_email: authLoginEmail,
            internal_auth_email: authLoginEmail,
          },
        } as never),
      },
      error: null,
    })
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    const adminDb = createResidentDiagnosticDb(
      [
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
      ],
      {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: {
                user: authUserFixture({
                  id: RESIDENT_USER_ID,
                  email: undefined,
                  phone: "+919000000002",
                  user_metadata: {
                    organization_id: TEST_ORGANIZATION_ID,
                    hostel_id: TEST_HOSTEL_ID,
                    resident_id: RESIDENT_USER_ID,
                  },
                } as never),
              },
              error: null,
            }),
            updateUserById,
          },
        },
        rpc,
      }
    )

    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(adminDb as never)
    vi.spyOn(UsersRepository.prototype, "getById").mockResolvedValue(
      userFixture({
        id: RESIDENT_USER_ID,
        email: null,
        phone: "+919000000002",
        default_role: "resident",
        metadata: {},
      })
    )

    const service = new AuthService({} as never)
    const credentials = await (
      service as unknown as {
        buildPasswordCredentialsForLogin(identifier: string, password: string): Promise<unknown>
      }
    ).buildPasswordCredentialsForLogin("90000 00002", "Temporary123!")

    expect(credentials).toEqual({
      email: authLoginEmail,
      password: "Temporary123!",
    })
    expect(updateUserById).toHaveBeenCalledWith(
      RESIDENT_USER_ID,
      expect.objectContaining({
        email: authLoginEmail,
        email_confirm: true,
        user_metadata: expect.objectContaining({
          auth_login_email: authLoginEmail,
          internal_auth_email: authLoginEmail,
        }),
      })
    )
    expect(rpc).toHaveBeenCalledWith(
      "repair_resident_auth_identity_atomic",
      expect.objectContaining({
        p_auth_login_email: authLoginEmail,
        p_internal_auth_email: authLoginEmail,
      })
    )
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
