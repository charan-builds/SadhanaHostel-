import "server-only"

import { badRequest } from "@/lib/api/api-error"
import { logger } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
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
  results: Array<{
    organizationId: string
    result: JobResult
  }>
}

export async function executeVercelCron(
  request: Request,
  cronName: string
): Promise<CronExecutionResult> {
  const auth = assertCronRequest(request)
  const schedule = getCronSchedule(cronName)

  if (!schedule) {
    throw badRequest("Unknown cron schedule.")
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
  }

  incrementMetric("cron.completed", 1, {
    cronName,
    source: auth.source,
  })

  logger.info({
    event: "cron.completed",
    message: "Scheduled cron execution completed.",
    metadata: {
      cronName,
      runId,
      organizationCount: organizations.length,
      results,
    },
  })

  return {
    cronName,
    source: auth.source,
    organizationCount: organizations.length,
    results,
  }
}
