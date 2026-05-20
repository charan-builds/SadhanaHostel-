import type { JobDefinition, OrganizationJobPayload } from "./types"

export type LeaveNotificationProcessingPayload = OrganizationJobPayload & {
  leaveRequestId?: string
}

export const leaveNotificationProcessingJob: JobDefinition<LeaveNotificationProcessingPayload> = {
  name: "leave_notification_processing",
  queueName: "notifications",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    [
      "leave_notification_processing",
      payload.organizationId,
      payload.leaveRequestId ?? "pending",
    ].join(":"),
  async run(payload) {
    return {
      status: "skipped",
      processed: 0,
      skipped: 0,
      failed: 0,
      message:
        "Leave notification processing is scaffolded. Connect notification logs once provider routing is chosen.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        leaveRequestId: payload.leaveRequestId,
      },
    }
  },
}
