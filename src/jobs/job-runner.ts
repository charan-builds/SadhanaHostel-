import { logError, logger } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import { measureAsync } from "@/lib/performance"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { JobsRepository } from "@/repositories/jobs.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"

import type { JobContext, JobDefinition, JobResult } from "./types"

export type RunJobOptions = {
  db?: AppSupabaseClient
  runId?: string
  requestedBy?: string | null
  organizationId?: string | null
  retryDelayMs?: number
}

export async function runJob<TPayload>(
  job: JobDefinition<TPayload>,
  payload: TPayload,
  options: RunJobOptions = {}
): Promise<JobResult> {
  const db = options.db ?? createSupabaseAdminClient()
  const idempotencyKey = job.buildIdempotencyKey(payload)
  const runId = options.runId ?? crypto.randomUUID()
  const maxAttempts = Math.max(1, job.maxAttempts)
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 250)
  let lastResult: JobResult | null = null

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    const context: JobContext = {
      runId,
      db,
      requestedBy: options.requestedBy ?? null,
      organizationId: options.organizationId ?? null,
      startedAt: new Date().toISOString(),
      attemptNumber,
      idempotencyKey,
    }

    lastResult = await executeJobAttempt(job, payload, context)

    if (lastResult.status !== "failed") {
      return lastResult
    }

    if (attemptNumber < maxAttempts) {
      await sleep(retryDelayMs * attemptNumber)
    }
  }

  return (
    lastResult ?? {
      status: "failed",
      processed: 0,
      skipped: 0,
      failed: 1,
      message: "Job failed before execution.",
    }
  )
}

async function executeJobAttempt<TPayload>(
  job: JobDefinition<TPayload>,
  payload: TPayload,
  context: JobContext
): Promise<JobResult> {
  const jobsRepository = new JobsRepository(context.db)

  logger.info({
    event: "job.started",
    message: "Background job started.",
    userId: context.requestedBy,
    organizationId: context.organizationId,
    metadata: {
      jobName: job.name,
      queueName: job.queueName,
      runId: context.runId,
      idempotencyKey: context.idempotencyKey,
      attemptNumber: context.attemptNumber,
    },
  })

  try {
    const result = await measureAsync(
      {
        name: `job_${job.name}`,
        kind: "service",
        slowMs: 5000,
        tags: {
          jobName: job.name,
          queueName: job.queueName,
        },
      },
      () => job.run(payload, context)
    )

    incrementMetric("jobs.completed", 1, {
      jobName: job.name,
      status: result.status,
    })

    await recordJobEventSafely(jobsRepository, {
      organization_id: context.organizationId,
      actor_user_id: context.requestedBy,
      table_name: "background_jobs",
      action: `job.${result.status}`,
      record_id: null,
      request_id: context.runId,
      metadata: {
        job_name: job.name,
        queue_name: job.queueName,
        idempotency_key: context.idempotencyKey,
        attempt_number: context.attemptNumber,
        result: toJson(result),
      } satisfies Json,
    })

    logger.info({
      event: "job.completed",
      message: "Background job completed.",
      userId: context.requestedBy,
      organizationId: context.organizationId,
      metadata: {
        jobName: job.name,
        queueName: job.queueName,
        runId: context.runId,
        result,
      },
    })

    return result
  } catch (error) {
    logError(error, {
      jobName: job.name,
      queueName: job.queueName,
      runId: context.runId,
      idempotencyKey: context.idempotencyKey,
      attemptNumber: context.attemptNumber,
    })
    incrementMetric("jobs.failed", 1, {
      jobName: job.name,
      queueName: job.queueName,
    })

    const failedResult = {
      status: "failed",
      processed: 0,
      skipped: 0,
      failed: 1,
      message: error instanceof Error ? error.message : "Background job failed.",
    } satisfies JobResult

    await recordJobEventSafely(jobsRepository, {
      organization_id: context.organizationId,
      actor_user_id: context.requestedBy,
      table_name: "background_jobs",
      action: "job.failed",
      record_id: null,
      request_id: context.runId,
      metadata: {
        job_name: job.name,
        queue_name: job.queueName,
        idempotency_key: context.idempotencyKey,
        attempt_number: context.attemptNumber,
        result: toJson(failedResult),
      } satisfies Json,
    })

    return failedResult
  }
}

async function recordJobEventSafely(
  jobsRepository: JobsRepository,
  values: Parameters<JobsRepository["recordJobEvent"]>[0]
) {
  try {
    await jobsRepository.recordJobEvent(values)
  } catch (error) {
    logError(error, {
      event: "job.audit_event_failed",
      jobAction: values.action,
      requestId: values.request_id,
    })
  }
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

function sleep(ms: number) {
  if (ms <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => setTimeout(resolve, ms))
}
