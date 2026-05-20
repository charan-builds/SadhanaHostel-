import { logError, logger } from "@/lib/logger"

import type { JobContext, JobDefinition, JobResult } from "./types"

export async function runJob<TPayload>(
  job: JobDefinition<TPayload>,
  payload: TPayload,
  context: Partial<JobContext> = {}
): Promise<JobResult> {
  const jobContext: JobContext = {
    runId: context.runId ?? crypto.randomUUID(),
    requestedBy: context.requestedBy ?? null,
    organizationId: context.organizationId ?? null,
    startedAt: context.startedAt ?? new Date().toISOString(),
  }
  const idempotencyKey = job.buildIdempotencyKey(payload)

  logger.info({
    event: "job.started",
    message: "Background job started.",
    userId: jobContext.requestedBy,
    organizationId: jobContext.organizationId,
    metadata: {
      jobName: job.name,
      queueName: job.queueName,
      runId: jobContext.runId,
      idempotencyKey,
    },
  })

  try {
    const result = await job.run(payload, jobContext)

    logger.info({
      event: "job.completed",
      message: "Background job completed.",
      userId: jobContext.requestedBy,
      organizationId: jobContext.organizationId,
      metadata: {
        jobName: job.name,
        queueName: job.queueName,
        runId: jobContext.runId,
        idempotencyKey,
        result,
      },
    })

    return result
  } catch (error) {
    logError(error, {
      jobName: job.name,
      queueName: job.queueName,
      runId: jobContext.runId,
      idempotencyKey,
    })

    return {
      status: "failed",
      processed: 0,
      skipped: 0,
      failed: 1,
      message: "Background job failed.",
    }
  }
}
