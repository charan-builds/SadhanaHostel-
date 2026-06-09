import "server-only"

import { badRequest } from "@/lib/api/api-error"
import { areCronJobsEnabled } from "@/config/launch"
import { logger, serializeError } from "@/lib/logger"
import { incrementMetric, recordTimingMetric } from "@/lib/metrics"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { OrganizationsRepository } from "@/repositories/organizations.repository"
import { OperationsRepository } from "@/repositories/operations.repository"

import { runJob } from "../job-runner"
import type { JobDefinition, JobResult } from "../types"
import { getCronSchedule } from "./cron-registry"
import { assertCronRequest } from "./scheduler-auth"

export type CronExecutionResult = {
  cronName: string
  source: "vercel-cron" | "manual"
  organizationCount: number
  durationMs: number
  outcomeSummary: Record<"completed" | "failed" | "skipped", number>
  results: Array<{
    organizationId: string
    result: JobResult
  }>
}

export async function executeVercelCron(
  request: Request,
  cronName: string
): Promise<CronExecutionResult> {
  const startedAt = Date.now()
  const auth = assertCronRequest(request)
  const schedule = getCronSchedule(cronName)

  if (!schedule) {
    throw badRequest("Unknown cron schedule.")
  }

  if (!areCronJobsEnabled()) {
    logger.warn({
      event: "cron.disabled",
      message: "Scheduled cron execution skipped because CRON_JOBS_ENABLED=false.",
      metadata: {
        cronName,
        source: auth.source,
      },
    })

    return {
      cronName,
      source: auth.source,
      organizationCount: 0,
      durationMs: Date.now() - startedAt,
      outcomeSummary: {
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      results: [],
    }
  }

  const now = new Date()
  const db = createSupabaseAdminClient()
  const organizationsRepository = new OrganizationsRepository(db)
  const operationsRepository = new OperationsRepository(db)
  const organizations = await organizationsRepository.listActiveOrganizations()
  const runId = crypto.randomUUID()
  const results: CronExecutionResult["results"] = []

  logger.info({
    event: "cron.started",
    message: "Scheduled cron execution started.",
    metadata: {
      cronName,
      source: auth.source,
      userAgent: auth.userAgent,
      schedule: schedule.schedule,
      runId,
      organizationCount: organizations.length,
    },
  })

  for (const organization of organizations) {
    try {
      const setting = await operationsRepository.getAutomationSetting({
        organizationId: organization.id,
        jobName: schedule.job.name,
      })

      if (setting && !setting.enabled) {
        results.push({
          organizationId: organization.id,
          result: {
            status: "skipped",
            processed: 0,
            skipped: 1,
            failed: 0,
            message: "Cron skipped because automation job is disabled for this organization.",
          },
        })
        continue
      }

      const payload = schedule.buildPayload({ organization, now }) as Record<string, unknown>
      const result = await runJob(
        schedule.job as JobDefinition<Record<string, unknown>>,
        payload,
        {
          db,
          runId: `${runId}:${organization.id}`,
          requestedBy: null,
          organizationId: organization.id,
        }
      )

      results.push({
        organizationId: organization.id,
        result,
      })
    } catch (error) {
      incrementMetric("cron.organization_failed", 1, {
        cronName,
        organizationId: organization.id,
        source: auth.source,
      })

      logger.error({
        event: "cron.organization_failed",
        message: "Scheduled cron execution failed for one organization; continuing remaining organizations.",
        organizationId: organization.id,
        error: serializeError(error),
        metadata: {
          cronName,
          jobName: schedule.job.name,
          runId,
          source: auth.source,
        },
      })

      results.push({
        organizationId: organization.id,
        result: {
          status: "failed",
          processed: 0,
          skipped: 0,
          failed: 1,
          message: "Cron failed for this organization; remaining organizations continued.",
          metadata: {
            error:
              error instanceof Error
                ? error.message
                : "Unknown organization cron failure.",
          },
        },
      })
    }
  }

  const outcomeSummary = summarizeCronResults(results)
  const durationMs = Date.now() - startedAt
  const failedOrganizations = outcomeSummary.failed

  incrementMetric("cron.completed", 1, {
    cronName,
    source: auth.source,
    status: failedOrganizations > 0 ? "partial_failure" : "completed",
  })
  recordTimingMetric("cron.duration", durationMs, {
    cronName,
    source: auth.source,
    status: failedOrganizations > 0 ? "partial_failure" : "completed",
  })

  for (const [status, count] of Object.entries(outcomeSummary)) {
    if (count === 0) {
      continue
    }

    incrementMetric("cron.organizations", count, {
      cronName,
      source: auth.source,
      status,
    })
  }

  logger.info({
    event: "cron.completed",
    message: "Scheduled cron execution completed.",
    metadata: {
      cronName,
      runId,
      organizationCount: organizations.length,
      durationMs,
      outcomeSummary,
      failedOrganizations,
      results,
    },
  })

  return {
    cronName,
    source: auth.source,
    organizationCount: organizations.length,
    durationMs,
    outcomeSummary,
    results,
  }
}

function summarizeCronResults(results: CronExecutionResult["results"]) {
  return results.reduce(
    (summary, item) => {
      if (item.result.status === "failed") {
        summary.failed += 1
      } else if (item.result.status === "skipped") {
        summary.skipped += 1
      } else {
        summary.completed += 1
      }

      return summary
    },
    {
      completed: 0,
      failed: 0,
      skipped: 0,
    }
  )
}
