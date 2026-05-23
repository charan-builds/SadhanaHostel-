import { OperationsRepository } from "@/repositories/operations.repository"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type CheckoutReconciliationPayload = OrganizationJobPayload & {
  dryRun?: boolean
}

export const checkoutReconciliationJob: JobDefinition<CheckoutReconciliationPayload> = {
  name: "checkout_reconciliation",
  queueName: "operations",
  maxAttempts: 2,
  buildIdempotencyKey: (payload) =>
    [
      "checkout_reconciliation",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      new Date().toISOString().slice(0, 10),
    ].join(":"),
  async run(payload, context) {
    const repository = new OperationsRepository(context.db)

    if (payload.dryRun) {
      return {
        status: "skipped",
        processed: 0,
        skipped: 1,
        failed: 0,
        message: "Dry run completed. No checked-out allocations were changed.",
      }
    }

    const processed = await repository.completeCheckedOutAllocations({
      organizationId: payload.organizationId,
      hostelId: payload.hostelId,
      actorUserId: context.requestedBy,
    })

    await repository.createAuditLog({
      organization_id: payload.organizationId,
      hostel_id: payload.hostelId ?? null,
      actor_user_id: context.requestedBy ?? null,
      table_name: "room_allocations",
      record_id: null,
      request_id: context.runId,
      action: "checkout.reconciliation.completed",
      metadata: {
        processed,
      },
      created_by: context.requestedBy ?? null,
      updated_by: context.requestedBy ?? null,
    })

    return {
      status: "completed",
      processed,
      skipped: 0,
      failed: 0,
      message: "Checked-out resident allocations reconciled.",
    }
  },
}
