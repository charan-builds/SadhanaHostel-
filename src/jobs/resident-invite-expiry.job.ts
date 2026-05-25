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
    const [expiredStale, expiredDuplicates] = await Promise.all([
      repository.expireDue({
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        limit: payload.limit ?? 500,
      }),
      repository.expireDuplicateActiveForResidents({
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        limit: payload.limit ?? 1000,
      }),
    ])
    const processed = expiredStale + expiredDuplicates

    return {
      status: "completed",
      processed,
      skipped: 0,
      failed: 0,
      message: "Expired stale resident activation invites.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        expiredStale,
        expiredDuplicates,
      },
    }
  },
}
