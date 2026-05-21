import { AdmissionsRepository } from "@/repositories/admissions.repository"
import { OrganizationsRepository } from "@/repositories/organizations.repository"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export const occupancyRecalculationJob: JobDefinition<OrganizationJobPayload> = {
  name: "occupancy_recalculation",
  queueName: "admissions",
  maxAttempts: 2,
  buildIdempotencyKey: (payload) =>
    ["occupancy_recalculation", payload.organizationId, payload.hostelId ?? "all"].join(":"),
  async run(payload, context) {
    const admissionsRepository = new AdmissionsRepository(context.db)
    const organizationsRepository = new OrganizationsRepository(context.db)
    const hostels = payload.hostelId
      ? [{ id: payload.hostelId }]
      : await organizationsRepository.listActiveHostels(payload.organizationId)
    let processed = 0

    for (const hostel of hostels) {
      await admissionsRepository.recalculateHostelCapacity(payload.organizationId, hostel.id)
      processed += 1
    }

    return {
      status: "completed",
      processed,
      skipped: 0,
      failed: 0,
      message: "Hostel occupancy capacity snapshots recalculated.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
      },
    }
  },
}
