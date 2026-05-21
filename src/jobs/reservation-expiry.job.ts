import { AdmissionsRepository } from "@/repositories/admissions.repository"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type ReservationExpiryPayload = OrganizationJobPayload & {
  limit?: number
}

export const reservationExpiryJob: JobDefinition<ReservationExpiryPayload> = {
  name: "reservation_expiry",
  queueName: "admissions",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    ["reservation_expiry", payload.organizationId, payload.hostelId ?? "all"].join(":"),
  async run(payload, context) {
    const repository = new AdmissionsRepository(context.db)
    const processed = await repository.expireReservations({
      organizationId: payload.organizationId,
      hostelId: payload.hostelId,
      limit: payload.limit ?? 200,
    })

    return {
      status: "completed",
      processed,
      skipped: 0,
      failed: 0,
      message: "Expired stale reservations and released held beds.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
      },
    }
  },
}
