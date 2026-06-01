import type { User } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import { RepositoryError } from "@/repositories/types"
import { ResidentInviteService, generateSignedInviteToken, hashInviteToken } from "@/services/invites"
import {
  RESIDENT_ID,
  ADMIN_USER_ID,
  residentFixture,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"
import type { ResidentInviteRow } from "@/types/invites"

const ACTIVATION_USER_ID = "00000000-0000-4000-8000-000000000088"

function createInviteFixture(overrides: Partial<ResidentInviteRow> = {}): ResidentInviteRow {
  const token = "v1.fixture.signature"

  return {
    id: "00000000-0000-4000-8000-000000000089",
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: RESIDENT_ID,
    email: "resident.test@sadhanahostel.example",
    phone: "+91 90000 00002",
    invite_code: "SBH-ABCDEFGH",
    invite_token_hash: hashInviteToken(token),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    used_at: null,
    revoked_at: null,
    invited_by: null,
    status: "pending",
    metadata: {},
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    ...overrides,
  }
}

function authUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: ACTIVATION_USER_ID,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-05-23T00:00:00.000Z",
    email: "resident.test@sadhanahostel.example",
    phone: "+919000000002",
    ...overrides,
  } as User
}

function createServiceHarness(invite: ResidentInviteRow) {
  const db = {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        createUser: vi.fn().mockResolvedValue({
          data: { user: authUserFixture() },
          error: null,
        }),
        updateUserById: vi.fn().mockResolvedValue({
          data: { user: authUserFixture() },
          error: null,
        }),
        getUserById: vi.fn().mockResolvedValue({
          data: { user: authUserFixture() },
          error: null,
        }),
        deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  }
  const invitesRepository = {
    findByTokenHash: vi.fn().mockResolvedValue(invite),
    findByCodeAndIdentity: vi.fn().mockResolvedValue(invite),
    listForResident: vi.fn().mockResolvedValue([invite]),
    markExpired: vi.fn(),
    supersedeForRecoveredIdentity: vi.fn().mockResolvedValue({
      ...invite,
      status: "revoked",
      revoked_at: "2026-05-23T01:00:00.000Z",
    }),
    activateInviteAtomic: vi.fn().mockResolvedValue(
      residentFixture({
        user_id: ACTIVATION_USER_ID,
        status: "draft",
      })
    ),
    recoverUsedInviteActivationAtomic: vi.fn().mockResolvedValue(
      residentFixture({
        user_id: ACTIVATION_USER_ID,
        status: "draft",
      })
    ),
  }
  const residentsRepository = {
    getById: vi.fn().mockResolvedValue(
      residentFixture({
        user_id: null,
        status: "draft",
        email: invite.email,
        phone: invite.phone,
      })
    ),
    getByUserId: vi.fn().mockResolvedValue(null),
  }
  const usersRepository = {
    getById: vi.fn().mockResolvedValue(null),
    updateProfile: vi.fn().mockResolvedValue({}),
  }
  const eventPublisher = {
    publish: vi.fn().mockResolvedValue(undefined),
  }
  const emailQueue = {
    sendTemplate: vi.fn().mockResolvedValue(undefined),
  }
  const service = new ResidentInviteService(db as never, {
    invitesRepository: invitesRepository as never,
    residentsRepository: residentsRepository as never,
    usersRepository: usersRepository as never,
    eventPublisher: eventPublisher as never,
    emailQueue,
  })

  return {
    service,
    db,
    invitesRepository,
    residentsRepository,
    usersRepository,
  }
}

describe("ResidentInviteService activation bootstrap", () => {
  it("creates an auth user and completes resident linkage through the atomic bootstrap RPC", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({ invite_token_hash: hashInviteToken(token) })
    const harness = createServiceHarness(invite)

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).resolves.toEqual({
      authenticatedIdentifier: invite.email,
      residentId: invite.resident_id,
      redirectTo: "/resident/onboarding",
    })

    expect(harness.db.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: invite.email,
        password: "StrongPassword123!",
        user_metadata: expect.objectContaining({
          organization_id: invite.organization_id,
          resident_id: invite.resident_id,
          activated_from_invite: true,
          resident_access_mode: "activation_link",
        }),
      })
    )
    expect(harness.invitesRepository.activateInviteAtomic).toHaveBeenCalledWith({
      inviteId: invite.id,
      inviteTokenHash: invite.invite_token_hash,
      authUserId: ACTIVATION_USER_ID,
    })
  })

  it("returns identity-aware safe metadata for phone-only invite lookup", async () => {
    const invite = createInviteFixture({
      email: null,
      phone: "90000 00002",
    })
    const harness = createServiceHarness(invite)

    await expect(
      harness.service.validateInvite({
        inviteCode: invite.invite_code,
      })
    ).resolves.toMatchObject({
      identityMode: "phone_only",
      phoneRequired: true,
      emailRequired: false,
      maskedPhone: expect.stringMatching(/0002$/),
      maskedEmail: null,
      authLinked: false,
      activationState: "activation_pending",
    })
  })

  it("returns identity-aware safe metadata for email-only invite lookup", async () => {
    const invite = createInviteFixture({
      email: "resident.test@sadhanahostel.example",
      phone: null,
    })
    const harness = createServiceHarness(invite)

    await expect(
      harness.service.validateInvite({
        inviteCode: invite.invite_code,
      })
    ).resolves.toMatchObject({
      identityMode: "email_only",
      phoneRequired: false,
      emailRequired: true,
      maskedEmail: "r******@sadhanahostel.example",
      maskedPhone: null,
    })
  })

  it("returns hybrid metadata when both resident identities are available", async () => {
    const invite = createInviteFixture()
    const harness = createServiceHarness(invite)

    await expect(
      harness.service.validateInvite({
        inviteCode: invite.invite_code,
      })
    ).resolves.toMatchObject({
      identityMode: "hybrid",
      phoneRequired: false,
      emailRequired: false,
      maskedEmail: "r******@sadhanahostel.example",
      maskedPhone: expect.stringMatching(/0002$/),
    })
  })

  it("activates phone-only residents without requiring an email identity", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({
      email: null,
      phone: "90000 00002",
      invite_token_hash: hashInviteToken(token),
    })
    const harness = createServiceHarness(invite)

    harness.db.auth.admin.createUser.mockResolvedValue({
      data: {
        user: authUserFixture({
          email: `resident-${invite.resident_id.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
          phone: "+919000000002",
          user_metadata: {
            internal_auth_email: `resident-${invite.resident_id.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
          },
        }),
      },
      error: null,
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).resolves.toEqual({
      authenticatedIdentifier: "+919000000002",
      residentId: invite.resident_id,
      redirectTo: "/resident/onboarding",
    })

    const payload = harness.db.auth.admin.createUser.mock.calls[0]?.[0]

    expect(payload).toMatchObject({
      email: `resident-${invite.resident_id.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
      email_confirm: true,
      phone: "+919000000002",
      phone_confirm: true,
      password: "StrongPassword123!",
      user_metadata: expect.objectContaining({
        resident_identity_mode: "phone",
        resident_id: invite.resident_id,
        auth_login_email: `resident-${invite.resident_id.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
        internal_auth_email: `resident-${invite.resident_id.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
        phone_password_login_strategy: "internal_email_alias",
      }),
    })
    expect(harness.usersRepository.updateProfile).toHaveBeenCalledWith(
      ACTIVATION_USER_ID,
      expect.objectContaining({
        email: null,
        phone: "+919000000002",
        metadata: expect.objectContaining({
          auth_login_email: `resident-${invite.resident_id.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
          internal_auth_email: `resident-${invite.resident_id.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
        }),
      })
    )
  })

  it("rejects email entry for phone-only activation codes", async () => {
    const invite = createInviteFixture({
      email: null,
      phone: "90000 00002",
    })
    const harness = createServiceHarness(invite)

    await expect(
      harness.service.activateInvite({
        inviteCode: invite.invite_code,
        email: "wrong@sadhanahostel.example",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "This invite uses phone verification. Enter the phone number shared with hostel administration.",
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it("rejects phone entry for email-only activation codes", async () => {
    const invite = createInviteFixture({
      email: "resident.test@sadhanahostel.example",
      phone: null,
    })
    const harness = createServiceHarness(invite)

    await expect(
      harness.service.activateInvite({
        inviteCode: invite.invite_code,
        phone: "9000000002",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "This invite uses email verification. Enter the email shared with hostel administration.",
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it("retries activation safely when the auth user already exists but the resident is not linked yet", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({ invite_token_hash: hashInviteToken(token) })
    const harness = createServiceHarness(invite)

    harness.db.auth.admin.listUsers.mockResolvedValue({
      data: { users: [authUserFixture()] },
      error: null,
    })

    await harness.service.activateInvite({
      token,
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword123!",
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
    expect(harness.db.auth.admin.updateUserById).toHaveBeenCalledWith(
      ACTIVATION_USER_ID,
      expect.objectContaining({ password: "StrongPassword123!" })
    )
    expect(harness.invitesRepository.activateInviteAtomic).toHaveBeenCalled()
  })

  it("recovers a concurrent activation race when Supabase reports a duplicate identity during create", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({ invite_token_hash: hashInviteToken(token) })
    const harness = createServiceHarness(invite)

    harness.db.auth.admin.listUsers
      .mockResolvedValueOnce({ data: { users: [] }, error: null })
      .mockResolvedValueOnce({ data: { users: [] }, error: null })
      .mockResolvedValueOnce({ data: { users: [authUserFixture()] }, error: null })
    harness.db.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).resolves.toEqual({
      authenticatedIdentifier: invite.email,
      residentId: invite.resident_id,
      redirectTo: "/resident/onboarding",
    })

    expect(harness.db.auth.admin.createUser).toHaveBeenCalledTimes(1)
    expect(harness.db.auth.admin.updateUserById).toHaveBeenCalledWith(
      ACTIVATION_USER_ID,
      expect.objectContaining({ password: "StrongPassword123!" })
    )
    expect(harness.invitesRepository.activateInviteAtomic).toHaveBeenCalledWith({
      inviteId: invite.id,
      inviteTokenHash: invite.invite_token_hash,
      authUserId: ACTIVATION_USER_ID,
    })
  })

  it("blocks reused invites before mutating auth or resident state", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({
      invite_token_hash: hashInviteToken(token),
      status: "used",
      used_at: "2026-05-23T01:00:00.000Z",
    })
    const harness = createServiceHarness(invite)

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "This invite was consumed but the resident account is not linked. Ask hostel administration to run onboarding repair and resend activation.",
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
    expect(harness.db.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(harness.invitesRepository.activateInviteAtomic).not.toHaveBeenCalled()
  })

  it("rejects a completed activation replay without mutating the resident password", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({
      invite_token_hash: hashInviteToken(token),
      status: "used",
      used_at: "2026-05-23T01:00:00.000Z",
    })
    const harness = createServiceHarness(invite)

    harness.residentsRepository.getById.mockResolvedValue(
      residentFixture({
        user_id: ACTIVATION_USER_ID,
        status: "draft",
        email: invite.email,
        phone: invite.phone,
      })
    )
    harness.db.auth.admin.listUsers.mockResolvedValue({
      data: { users: [authUserFixture()] },
      error: null,
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
      details: { reason: "invite_already_used" },
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
    expect(harness.db.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(harness.invitesRepository.activateInviteAtomic).not.toHaveBeenCalled()
  })

  it("prevents activation replay after the first successful invite use", async () => {
    const token = generateSignedInviteToken()
    let invite = createInviteFixture({ invite_token_hash: hashInviteToken(token) })
    let resident = residentFixture({
      user_id: null,
      status: "draft",
      email: invite.email,
      phone: invite.phone,
    })
    const authUsers: User[] = []
    const harness = createServiceHarness(invite)

    harness.invitesRepository.findByTokenHash.mockImplementation(async () => invite)
    harness.invitesRepository.listForResident.mockImplementation(async () => [invite])
    harness.residentsRepository.getById.mockImplementation(async () => resident)
    harness.db.auth.admin.listUsers.mockImplementation(async () => ({
      data: { users: [...authUsers] },
      error: null,
    }))
    harness.db.auth.admin.createUser.mockImplementation(async () => {
      const user = authUserFixture({
        user_metadata: {
          organization_id: invite.organization_id,
          resident_id: invite.resident_id,
          activated_from_invite: true,
        },
      })
      authUsers.push(user)

      return { data: { user }, error: null }
    })
    harness.invitesRepository.activateInviteAtomic.mockImplementation(async () => {
      invite = {
        ...invite,
        status: "used",
        used_at: "2026-05-23T01:00:00.000Z",
        updated_by: ACTIVATION_USER_ID,
      }
      resident = residentFixture({
        user_id: ACTIVATION_USER_ID,
        status: "draft",
        email: invite.email,
        phone: invite.phone,
      })

      return resident
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).resolves.toEqual({
      authenticatedIdentifier: invite.email,
      residentId: invite.resident_id,
      redirectTo: "/resident/onboarding",
    })

    for (let index = 0; index < 4; index += 1) {
      await expect(
        harness.service.activateInvite({
          token,
          password: "StrongPassword123!",
          confirmPassword: "StrongPassword123!",
        })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        details: { reason: "invite_already_used" },
      })
    }

    expect(
      harness.db.auth.admin.updateUserById.mock.calls.some(([, payload]) =>
        payload ? "password" in payload : false
      )
    ).toBe(false)
    expect(authUsers).toHaveLength(1)
    expect(harness.db.auth.admin.createUser).toHaveBeenCalledTimes(1)
    expect(harness.db.auth.admin.deleteUser).not.toHaveBeenCalled()
    expect(harness.invitesRepository.activateInviteAtomic).toHaveBeenCalledTimes(1)
    expect(harness.invitesRepository.recoverUsedInviteActivationAtomic).not.toHaveBeenCalled()
  })

  it("recovers an interrupted activation when the invite is used but resident linkage is missing", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({
      invite_token_hash: hashInviteToken(token),
      status: "used",
      used_at: "2026-05-23T01:00:00.000Z",
    })
    const harness = createServiceHarness(invite)

    harness.residentsRepository.getById.mockResolvedValue(
      residentFixture({
        user_id: null,
        status: "draft",
        email: invite.email,
        phone: invite.phone,
      })
    )
    harness.db.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          authUserFixture({
            user_metadata: {
              organization_id: invite.organization_id,
              resident_id: invite.resident_id,
            },
          }),
        ],
      },
      error: null,
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).resolves.toEqual({
      authenticatedIdentifier: invite.email,
      residentId: invite.resident_id,
      redirectTo: "/resident/onboarding",
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
    expect(harness.db.auth.admin.updateUserById).toHaveBeenCalledWith(
      ACTIVATION_USER_ID,
      expect.any(Object)
    )
    expect(harness.db.auth.admin.updateUserById.mock.calls[0]?.[1]).not.toHaveProperty(
      "password"
    )
    expect(harness.invitesRepository.recoverUsedInviteActivationAtomic).toHaveBeenCalledWith({
      inviteId: invite.id,
      inviteTokenHash: invite.invite_token_hash,
      authUserId: ACTIVATION_USER_ID,
    })
    expect(harness.invitesRepository.activateInviteAtomic).not.toHaveBeenCalled()
  })

  it("rejects a used invite even when the resident-linked auth user can be loaded", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({
      invite_token_hash: hashInviteToken(token),
      status: "used",
      used_at: "2026-05-23T01:00:00.000Z",
    })
    const harness = createServiceHarness(invite)

    harness.residentsRepository.getById.mockResolvedValue(
      residentFixture({
        user_id: ACTIVATION_USER_ID,
        status: "draft",
        email: invite.email,
        phone: invite.phone,
      })
    )
    harness.db.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    })
    harness.db.auth.admin.getUserById.mockResolvedValue({
      data: { user: authUserFixture() },
      error: null,
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reason: "invite_already_used" },
    })

    expect(harness.db.auth.admin.getUserById).toHaveBeenCalledWith(ACTIVATION_USER_ID)
    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
    expect(harness.db.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(harness.invitesRepository.activateInviteAtomic).not.toHaveBeenCalled()
  })

  it("blocks suspended onboarding before creating auth users", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({ invite_token_hash: hashInviteToken(token) })
    const harness = createServiceHarness(invite)

    harness.residentsRepository.getById.mockResolvedValue(
      residentFixture({
        user_id: null,
        status: "suspended",
        email: invite.email,
        phone: invite.phone,
      })
    )

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "Resident access is suspended. Ask hostel administration to reactivate onboarding before using this invite.",
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
    expect(harness.invitesRepository.activateInviteAtomic).not.toHaveBeenCalled()
  })

  it("maps bootstrap lifecycle failures to an actionable repair message", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({ invite_token_hash: hashInviteToken(token) })
    const harness = createServiceHarness(invite)

    harness.invitesRepository.activateInviteAtomic.mockRejectedValue(
      new RepositoryError("resident_activation_blocked_onboarding_status:suspended", "23514")
    )

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "Resident activation is blocked because onboarding is suspended. Run onboarding repair or resume onboarding from the admin panel before retrying.",
    })

    expect(harness.db.auth.admin.deleteUser).toHaveBeenCalledWith(ACTIVATION_USER_ID)
  })

  it("blocks phone reuse when an existing auth account belongs to another organization", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({
      email: null,
      invite_token_hash: hashInviteToken(token),
    })
    const harness = createServiceHarness(invite)

    harness.db.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          authUserFixture({
            email: undefined,
            phone: "+919000000002",
            user_metadata: {
              organization_id: "00000000-0000-4000-8000-000000009999",
            },
          } as Partial<User>),
        ],
      },
      error: null,
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "This login account belongs to another organization.",
    })

    expect(harness.db.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(harness.invitesRepository.activateInviteAtomic).not.toHaveBeenCalled()
  })

  it("blocks phone reuse when an existing auth account is marked for another resident", async () => {
    const token = generateSignedInviteToken()
    const linkedResidentId = "00000000-0000-4000-8000-000000009998"
    const invite = createInviteFixture({
      email: null,
      invite_token_hash: hashInviteToken(token),
    })
    const harness = createServiceHarness(invite)

    harness.residentsRepository.getById.mockImplementation(async (residentId: string) =>
      residentFixture({
        id: residentId,
        user_id: residentId === linkedResidentId ? ACTIVATION_USER_ID : null,
        status: "draft",
        email: null,
        phone: residentId === linkedResidentId ? "+919999999999" : invite.phone,
      })
    )

    harness.db.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          authUserFixture({
            email: undefined,
            phone: "+919000000002",
            user_metadata: {
              organization_id: invite.organization_id,
              resident_id: linkedResidentId,
            },
          } as Partial<User>),
        ],
      },
      error: null,
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "This login account belongs to a different resident identity. Ask hostel administration to merge duplicates or repair auth linkage before retrying.",
    })

    expect(harness.db.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(harness.invitesRepository.activateInviteAtomic).not.toHaveBeenCalled()
  })

  it("recovers duplicate draft activation when the auth identity already belongs to a same-phone resident", async () => {
    const token = generateSignedInviteToken()
    const linkedResidentId = "00000000-0000-4000-8000-000000009997"
    const invite = createInviteFixture({
      email: null,
      phone: "90000 00002",
      invite_token_hash: hashInviteToken(token),
    })
    const harness = createServiceHarness(invite)

    harness.residentsRepository.getById.mockImplementation(async (residentId: string) =>
      residentFixture({
        id: residentId,
        user_id: residentId === linkedResidentId ? ACTIVATION_USER_ID : null,
        status: "draft",
        email: null,
        phone: invite.phone,
      })
    )
    harness.db.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          authUserFixture({
            email: undefined,
            phone: "+919000000002",
            user_metadata: {
              organization_id: invite.organization_id,
              resident_id: linkedResidentId,
            },
          } as Partial<User>),
        ],
      },
      error: null,
    })
    harness.db.auth.admin.updateUserById.mockResolvedValue({
      data: {
        user: authUserFixture({
          email: `resident-${linkedResidentId.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
          phone: "+919000000002",
          user_metadata: {
            internal_auth_email: `resident-${linkedResidentId.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
          },
        }),
      },
      error: null,
    })

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).resolves.toEqual({
      authenticatedIdentifier: "+919000000002",
      residentId: linkedResidentId,
      redirectTo: "/resident/onboarding",
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
    expect(harness.db.auth.admin.updateUserById).toHaveBeenCalledWith(
      ACTIVATION_USER_ID,
      expect.objectContaining({
        email: `resident-${linkedResidentId.replace(/-/g, "")}@auth.sadhanahostel.invalid`,
        password: "StrongPassword123!",
      })
    )
    expect(harness.invitesRepository.supersedeForRecoveredIdentity).toHaveBeenCalledWith({
      invite,
      actorUserId: ACTIVATION_USER_ID,
      linkedResidentId,
    })
    expect(harness.invitesRepository.activateInviteAtomic).not.toHaveBeenCalled()
  })

  it("expires stale pending invites without creating auth users", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({
      invite_token_hash: hashInviteToken(token),
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    const harness = createServiceHarness(invite)

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This invite has expired. Ask the hostel admin to resend access.",
    })

    expect(harness.invitesRepository.markExpired).toHaveBeenCalledWith(invite.id)
    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it("maps atomic resident-link conflicts to resident-safe activation guidance", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({ invite_token_hash: hashInviteToken(token) })
    const harness = createServiceHarness(invite)

    harness.invitesRepository.activateInviteAtomic.mockRejectedValue(
      new RepositoryError("resident_already_linked", "23505")
    )

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This resident profile is already linked to another login account.",
    })
  })

  it("rolls back a newly created auth user when the activation bootstrap cannot finish", async () => {
    const token = generateSignedInviteToken()
    const invite = createInviteFixture({ invite_token_hash: hashInviteToken(token) })
    const harness = createServiceHarness(invite)

    harness.invitesRepository.activateInviteAtomic.mockRejectedValue(
      new RepositoryError("Invalid resident activation bootstrap update", "P0001")
    )

    await expect(
      harness.service.activateInvite({
        token,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "Activation was blocked by resident lifecycle validation. Ask the admin to run onboarding repair, then resend activation.",
    })

    expect(harness.db.auth.admin.deleteUser).toHaveBeenCalledWith(ACTIVATION_USER_ID)
  })

  it("issues phone-first temporary password access without storing the raw password", async () => {
    const invite = createInviteFixture({
      email: null,
      phone: "90000 00002",
    })
    const authService = {
      requireAdmin: vi.fn().mockResolvedValue(adminAuthContext()),
      requireOrganizationAccess: vi.fn(),
      requireHostelAccess: vi.fn(),
    }
    const residentsRepository = {
      getById: vi.fn().mockResolvedValue(
        residentFixture({
          id: invite.resident_id,
          user_id: null,
          status: "draft",
          email: null,
          phone: invite.phone,
        })
      ),
    }
    const invitesRepository = {
      revokeActiveForResident: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(invite),
      getById: vi.fn().mockResolvedValue({
        ...invite,
        status: "used",
        used_at: "2026-05-23T00:05:00.000Z",
        updated_by: ACTIVATION_USER_ID,
      }),
    }
    const activationService = {
      activateInvite: vi.fn().mockResolvedValue({
        authenticatedIdentifier: "+919000000002",
        residentId: invite.resident_id,
        redirectTo: "/resident/onboarding",
      }),
    }
    const eventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    }
    const emailQueue = {
      sendTemplate: vi.fn().mockResolvedValue(undefined),
    }
    const service = new ResidentInviteService({} as never, {
      authService: authService as never,
      residentsRepository: residentsRepository as never,
      invitesRepository: invitesRepository as never,
      activationService,
      eventPublisher,
      emailQueue,
    })

    const result = await service.createResidentInvite({
      organizationId: TEST_ORGANIZATION_ID,
      residentId: invite.resident_id,
      deliveryChannel: "temp_password",
      expiresInHours: 72,
    })

    expect(invitesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+919000000002",
        invited_by: ADMIN_USER_ID,
        metadata: expect.objectContaining({
          delivery_channel: "temp_password",
          access_mode: "temporary_password",
          temporary_password_expires_at: expect.any(String),
        }),
      })
    )
    expect(activationService.activateInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        password: result.delivery.temporaryPassword,
        confirmPassword: result.delivery.temporaryPassword,
      })
    )
    expect(result.activationLink).toBeNull()
    expect(result.loginLink).toContain("/resident/login")
    expect(result.delivery.accessMode).toBe("temporary_password")
    expect(result.delivery.temporaryPassword).toMatch(/^Sbh-/)
    expect(result.whatsappShareUrl ?? "").toContain(encodeURIComponent("Temporary password:"))
  })
})
