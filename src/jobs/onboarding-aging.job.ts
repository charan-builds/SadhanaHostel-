import { NotificationService } from "@/services/notifications"
import { OperationsRepository } from "@/repositories/operations.repository"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type OnboardingAgingPayload = OrganizationJobPayload & {
  olderThanDays?: number
  limit?: number
}

export const onboardingAgingJob: JobDefinition<OnboardingAgingPayload> = {
  name: "onboarding_aging",
  queueName: "operations",
  maxAttempts: 2,
  buildIdempotencyKey: (payload) =>
    [
      "onboarding_aging",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      new Date().toISOString().slice(0, 10),
    ].join(":"),
  async run(payload, context) {
    const repository = new OperationsRepository(context.db)
    const notificationService = new NotificationService(context.db)
    const cutoff = new Date(
      Date.now() - (payload.olderThanDays ?? 7) * 24 * 60 * 60 * 1000
    ).toISOString()
    const residents = await repository.list("residents", {
      organizationId: payload.organizationId,
      hostelId: payload.hostelId,
      select: "id,user_id,hostel_id,full_name,onboarding_status,updated_at",
      in: {
        onboarding_status: [
          "invited",
          "activated",
          "profile_incomplete",
          "documents_pending",
          "rejected",
        ],
      },
      deletedAtNull: true,
      limit: payload.limit ?? 100,
    })
    let processed = 0
    let skipped = 0

    for (const resident of residents) {
      const residentId = typeof resident.id === "string" ? resident.id : null
      const userId = typeof resident.user_id === "string" ? resident.user_id : null
      const onboardingStatus =
        typeof resident.onboarding_status === "string"
          ? resident.onboarding_status
          : null

      if (
        typeof resident.updated_at === "string" &&
        resident.updated_at > cutoff
      ) {
        skipped += 1
        continue
      }

      await notificationService.queue({
        organizationId: payload.organizationId,
        hostelId: typeof resident.hostel_id === "string" ? resident.hostel_id : payload.hostelId,
        channel: "in_app",
        recipient: {
          userId,
          residentId,
        },
        actorUserId: context.requestedBy,
        message: {
          title: "Complete hostel onboarding",
          body: "Your resident portal remains limited until profile and document verification is complete.",
          templateKey: "onboarding.aging.reminder",
          payload: {
            residentId,
            onboardingStatus,
          },
        },
      })
      processed += 1
    }

    await repository.createAuditLog({
      organization_id: payload.organizationId,
      hostel_id: payload.hostelId ?? null,
      actor_user_id: context.requestedBy ?? null,
      table_name: "residents",
      record_id: null,
      request_id: context.runId,
      action: "onboarding.aging.processed",
      metadata: {
        processed,
        skipped,
        olderThanDays: payload.olderThanDays ?? 7,
      },
      created_by: context.requestedBy ?? null,
      updated_by: context.requestedBy ?? null,
    })

    return {
      status: "completed",
      processed,
      skipped,
      failed: 0,
      message: "Onboarding aging reminders processed.",
    }
  },
}
