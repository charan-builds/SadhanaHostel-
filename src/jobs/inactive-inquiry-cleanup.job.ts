import { subDays } from "date-fns"

import { AdmissionsRepository } from "@/repositories/admissions.repository"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type InactiveInquiryCleanupPayload = OrganizationJobPayload & {
  olderThanDays?: number
}

export const inactiveInquiryCleanupJob: JobDefinition<InactiveInquiryCleanupPayload> = {
  name: "inactive_inquiry_cleanup",
  queueName: "admissions",
  maxAttempts: 2,
  buildIdempotencyKey: (payload) =>
    [
      "inactive_inquiry_cleanup",
      payload.organizationId,
      payload.hostelId ?? "all",
      payload.olderThanDays ?? 90,
    ].join(":"),
  async run(payload, context) {
    const repository = new AdmissionsRepository(context.db)
    const olderThanIso = subDays(new Date(), payload.olderThanDays ?? 90).toISOString()
    const processed = await repository.markInactiveLeadsCancelled(
      payload.organizationId,
      olderThanIso
    )

    return {
      status: "completed",
      processed,
      skipped: 0,
      failed: 0,
      message: "Inactive admission inquiries cleaned up.",
      metadata: {
        organizationId: payload.organizationId,
        olderThanIso,
      },
    }
  },
}
