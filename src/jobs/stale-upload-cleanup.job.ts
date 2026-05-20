import type { JobDefinition, OrganizationJobPayload } from "./types"

export type StaleUploadCleanupPayload = OrganizationJobPayload & {
  olderThanHours: number
}

export const staleUploadCleanupJob: JobDefinition<StaleUploadCleanupPayload> = {
  name: "stale_upload_cleanup",
  queueName: "maintenance",
  maxAttempts: 2,
  buildIdempotencyKey: (payload) =>
    [
      "stale_upload_cleanup",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      payload.olderThanHours,
    ].join(":"),
  async run(payload) {
    return {
      status: "skipped",
      processed: 0,
      skipped: 0,
      failed: 0,
      message:
        "Stale upload cleanup is scaffolded. Implement object/document reconciliation before scheduling.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        olderThanHours: payload.olderThanHours,
      },
    }
  },
}
