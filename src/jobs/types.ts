import type { AppSupabaseClient } from "@/repositories/types"

export type JobStatus = "completed" | "skipped" | "failed"

export type JobContext = {
  runId: string
  db: AppSupabaseClient
  requestedBy?: string | null
  organizationId?: string | null
  startedAt: string
  attemptNumber: number
  idempotencyKey: string
}

export type JobResult = {
  status: JobStatus
  processed: number
  skipped: number
  failed: number
  message: string
  metadata?: Record<string, unknown>
}

export type JobDefinition<TPayload = Record<string, unknown>> = {
  name: string
  queueName: string
  maxAttempts: number
  buildIdempotencyKey: (payload: TPayload) => string
  run: (payload: TPayload, context: JobContext) => Promise<JobResult>
}

export type OrganizationJobPayload = {
  organizationId: string
  hostelId?: string
}
