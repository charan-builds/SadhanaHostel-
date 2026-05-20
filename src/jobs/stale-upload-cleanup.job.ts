import { UploadsRepository } from "@/repositories/uploads.repository"

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
  async run(payload, context) {
    const uploadsRepository = new UploadsRepository(context.db)
    const olderThan = new Date(Date.now() - payload.olderThanHours * 60 * 60 * 1000)
    const documents = await uploadsRepository.listStalePendingDocuments(
      payload.organizationId,
      olderThan.toISOString()
    )
    let processed = 0
    let failed = 0

    for (const document of documents) {
      if (payload.hostelId && document.hostel_id !== payload.hostelId) {
        continue
      }

      try {
        await uploadsRepository.removeObject(document.bucket_name, document.storage_path)
        await uploadsRepository.updateDocument(document.id, payload.organizationId, {
          is_active: false,
          deleted_at: new Date().toISOString(),
          metadata: {
            cleanup_job_run_id: context.runId,
            cleanup_reason: "stale_pending_upload",
          },
        })
        processed += 1
      } catch {
        failed += 1
      }
    }

    return {
      status: failed > 0 ? "failed" : "completed",
      processed,
      skipped: documents.length - processed - failed,
      failed,
      message: "Stale pending uploads cleaned up.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        olderThanHours: payload.olderThanHours,
      },
    }
  },
}
