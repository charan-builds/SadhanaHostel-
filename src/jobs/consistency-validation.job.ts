import { OperationsRepository } from "@/repositories/operations.repository"
import { scanConsistency } from "@/services/operations/consistency.service"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type ConsistencyValidationPayload = OrganizationJobPayload & {
  persist?: boolean
}

export const consistencyValidationJob: JobDefinition<ConsistencyValidationPayload> = {
  name: "consistency_validation",
  queueName: "operations",
  maxAttempts: 2,
  buildIdempotencyKey: (payload) =>
    [
      "consistency_validation",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      new Date().toISOString().slice(0, 13),
    ].join(":"),
  async run(payload, context) {
    const repository = new OperationsRepository(context.db)
    const report = await scanConsistency(repository, {
      organizationId: payload.organizationId,
      hostelId: payload.hostelId,
      runId: context.runId,
      actorUserId: context.requestedBy,
      persist: payload.persist ?? true,
    })

    return {
      status: "completed",
      processed: report.findings.length,
      skipped: 0,
      failed: 0,
      message: "Consistency scan completed.",
      metadata: {
        score: report.score,
        summaries: report.summaries,
        findings: report.findings,
      },
    }
  },
}
