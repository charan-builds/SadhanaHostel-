import { ResidentInvitesRepository } from "@/repositories/resident-invites.repository"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type ResidentInviteExpiryPayload = OrganizationJobPayload & {
  limit?: number
}

export const residentInviteExpiryJob: JobDefinition<ResidentInviteExpiryPayload> = {
  name: "resident_invite_expiry",
  queueName: "admissions",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    ["resident_invite_expiry", payload.organizationId, payload.hostelId ?? "all"].join(":"),
  async run(payload, context) {
    const repository = new ResidentInvitesRepository(context.db)
    const cleanup = await repository.cleanupOnboardingAccess({
      organizationId: payload.organizationId,
      hostelId: payload.hostelId,
      limit: payload.limit ?? 1000,
    })
    const processed =
      cleanup.expired_count +
      cleanup.activated_invites_revoked_count +
      cleanup.duplicate_invites_revoked_count

    return {
      status: "completed",
      processed,
      skipped: 0,
      failed: 0,
      message: "Expired stale resident activation invites.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        expiredStale: cleanup.expired_count,
        revokedForActivatedResidents: cleanup.activated_invites_revoked_count,
        expiredDuplicates: cleanup.duplicate_invites_revoked_count,
      },
    }
  },
}
