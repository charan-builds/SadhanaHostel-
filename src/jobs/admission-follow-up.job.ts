import { AdmissionsRepository } from "@/repositories/admissions.repository"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type AdmissionFollowUpPayload = OrganizationJobPayload & {
  limit?: number
}

export const admissionFollowUpJob: JobDefinition<AdmissionFollowUpPayload> = {
  name: "admission_follow_up",
  queueName: "admissions",
  maxAttempts: 2,
  buildIdempotencyKey: (payload) =>
    ["admission_follow_up", payload.organizationId, payload.hostelId ?? "all"].join(":"),
  async run(payload, context) {
    const repository = new AdmissionsRepository(context.db)
    const leads = await repository.listDueFollowUps(payload.organizationId, payload.limit ?? 100)

    return {
      status: "completed",
      processed: leads.length,
      skipped: 0,
      failed: 0,
      message: "Admission follow-up reminders identified.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        leadIds: leads.map((lead) => lead.id).slice(0, 50),
      },
    }
  },
}
