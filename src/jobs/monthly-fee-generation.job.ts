import type { JobDefinition, OrganizationJobPayload } from "./types"

export type MonthlyFeeGenerationPayload = OrganizationJobPayload & {
  periodMonth: string
}

export const monthlyFeeGenerationJob: JobDefinition<MonthlyFeeGenerationPayload> = {
  name: "monthly_fee_generation",
  queueName: "finance",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    [
      "monthly_fee_generation",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      payload.periodMonth,
    ].join(":"),
  async run(payload) {
    return {
      status: "skipped",
      processed: 0,
      skipped: 0,
      failed: 0,
      message:
        "Monthly fee generation is scaffolded. Wire this job to fee repositories after billing rules are finalized.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        periodMonth: payload.periodMonth,
      },
    }
  },
}
