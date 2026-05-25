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
      },
    },
  }
  const invitesRepository = {
    findByTokenHash: vi.fn().mockResolvedValue(invite),
    findByCodeAndIdentity: vi.fn().mockResolvedValue(invite),
    markExpired: vi.fn(),
    activateInviteAtomic: vi.fn().mockResolvedValue(
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
      })
    )
    expect(harness.invitesRepository.activateInviteAtomic).toHaveBeenCalledWith({
      inviteId: invite.id,
      inviteTokenHash: invite.invite_token_hash,
      authUserId: ACTIVATION_USER_ID,
    })
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
      message: "This invite is no longer active.",
    })

    expect(harness.db.auth.admin.createUser).not.toHaveBeenCalled()
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
        phone: invite.phone,
        invited_by: ADMIN_USER_ID,
        metadata: expect.objectContaining({
          delivery_channel: "temp_password",
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
