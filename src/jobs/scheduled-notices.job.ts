import type { JobDefinition, OrganizationJobPayload } from "./types"

export type ScheduledNoticesPayload = OrganizationJobPayload & {
  runAt: string
}

export const scheduledNoticesJob: JobDefinition<ScheduledNoticesPayload> = {
  name: "scheduled_notices",
  queueName: "notifications",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    [
      "scheduled_notices",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      payload.runAt.slice(0, 16),
    ].join(":"),
  async run(payload) {
    return {
      status: "skipped",
      processed: 0,
      skipped: 0,
      failed: 0,
      message:
        "Scheduled notices are scaffolded. Add notice repository selection and notification fan-out before scheduling.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        runAt: payload.runAt,
      },
    }
  },
}
