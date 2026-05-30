import "server-only"

import { runJob, type JobDefinition, jobRegistry } from "@/jobs"
import { cronRegistry } from "@/jobs/scheduler/cron-registry"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OperationsRepository } from "@/repositories/operations.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type {
  AutomationDashboard,
  AutomationJobConfig,
  AutomationRunResult,
} from "@/types/operations"
import {
  automationDashboardQuerySchema,
  automationRunSchema,
  automationSettingsSchema,
} from "@/validations/operations.validation"

import { AuthService } from "../auth.service"
import { scanConsistency } from "./consistency.service"

export class AutomationService {
  private readonly authService: AuthService
  private readonly repository: OperationsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.repository = new OperationsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new AutomationService(db)
  }

  async getDashboard(input: unknown): Promise<AutomationDashboard> {
    const values = automationDashboardQuerySchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")
    const organizationId = values.organizationId ?? context.organizationId
    const hostelId = values.hostelId ?? context.hostelIds[0] ?? null

    if (!organizationId) {
      return {
        organizationId: "unassigned",
        hostelId,
        jobs: buildJobConfigs(),
        recentRuns: [],
        consistency: {
          organizationId: "unassigned",
          hostelId,
          generatedAt: new Date().toISOString(),
          score: 0,
          findings: [],
          summaries: {
            critical: 1,
            high: 0,
            medium: 0,
            low: 0,
            informational: 0,
            totalFindings: 1,
          },
        },
      }
    }

    this.authService.requireHostelAccess(context, organizationId, hostelId)

    const [recentRuns, consistency, settings] = await Promise.all([
      this.repository.listRecentJobEvents(organizationId, 25),
      scanConsistency(this.repository, {
        organizationId,
        hostelId,
        actorUserId: context.authUser.id,
      }),
      this.repository.listAutomationSettings(organizationId, hostelId),
    ])

    return {
      organizationId,
      hostelId,
      jobs: buildJobConfigs(settings),
      recentRuns: recentRuns.map((run) => {
        const metadata = toRecord(run.metadata)
        const result = toRecord(metadata.result)

        return {
          id: run.id,
          jobName:
            typeof metadata.job_name === "string"
              ? metadata.job_name
              : typeof result.jobName === "string"
                ? result.jobName
                : null,
          status: run.action.replace("job.", ""),
          createdAt: run.created_at,
          requestId: run.request_id,
          metadata,
        }
      }),
      consistency,
    }
  }

  async run(input: unknown): Promise<AutomationRunResult> {
    const values = automationRunSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const setting = await this.repository.getAutomationSetting({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      jobName: values.name,
    })

    if (setting && !setting.enabled) {
      return {
        jobName: values.name,
        dryRun: values.dryRun,
        result: {
          status: "skipped",
          processed: 0,
          skipped: 1,
          failed: 0,
          message: "Automation job is disabled for this tenant.",
        },
      }
    }

    const safePayload = { ...values.payload }
    delete safePayload.organizationId
    delete safePayload.hostelId

    const payload = {
      ...safePayload,
      organizationId: values.organizationId,
      ...(values.hostelId ? { hostelId: values.hostelId } : {}),
    }

    if (values.dryRun || setting?.dry_run_only) {
      return {
        jobName: values.name,
        dryRun: true,
        result: {
          status: "skipped",
          processed: 0,
          skipped: 1,
          failed: 0,
          message: "Dry run completed. No records were changed.",
          metadata: {
            payload,
          },
        },
      }
    }

    const job = jobRegistry[values.name] as JobDefinition<Record<string, unknown>>
    const result = await runJob(job, payload, {
      db: this.db,
      requestedBy: context.authUser.id,
      organizationId: values.organizationId,
    })

    return {
      jobName: values.name,
      dryRun: false,
      result,
    }
  }

  async updateSettings(input: unknown) {
    const values = automationSettingsSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const setting = await this.repository.upsertAutomationSetting({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      jobName: values.name,
      enabled: values.enabled,
      cronSchedule: values.cronSchedule,
      dryRunOnly: values.dryRunOnly,
      actorUserId: context.authUser.id,
    })

    await this.repository.createAuditLog({
      organization_id: values.organizationId,
      hostel_id: values.hostelId ?? null,
      actor_user_id: context.authUser.id,
      table_name: "automation_job_settings",
      record_id: typeof setting.id === "string" ? setting.id : null,
      action: "automation.settings.updated",
      metadata: {
        jobName: values.name,
        enabled: values.enabled,
        cronSchedule: values.cronSchedule,
        dryRunOnly: values.dryRunOnly,
      },
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    return setting
  }
}

function buildJobConfigs(settings: Array<{
  job_name: string
  enabled: boolean
  cron_schedule: string
  dry_run_only: boolean
}> = []): AutomationJobConfig[] {
  const cronByJobName = new Map(
    Object.values(cronRegistry).map((cron) => [cron.job.name, cron])
  )
  const settingsByJobName = new Map(settings.map((setting) => [setting.job_name, setting]))

  return Object.values(jobRegistry).map((job) => {
    const cron = cronByJobName.get(job.name)
    const setting = settingsByJobName.get(job.name)

    return {
      name: job.name,
      cronName: cron?.name,
      queueName: job.queueName,
      title: humanizeJobName(job.name),
      description: cron?.description ?? fallbackDescription(job.name),
      schedule: setting?.cron_schedule ?? cron?.schedule ?? "manual",
      enabled: setting?.enabled ?? true,
      dryRunSupported: true,
      destructive:
        job.name.includes("cleanup") ||
        job.name.includes("expiry") ||
        job.name.includes("reconciliation"),
    }
  })
}

function fallbackDescription(name: string) {
  if (name === "consistency_validation") {
    return "Validate operational consistency across residents, rooms, payments, invoices, uploads, and invites."
  }

  if (name === "onboarding_aging") {
    return "Detect incomplete onboarding records and queue follow-up notifications."
  }

  if (name === "checkout_reconciliation") {
    return "Release room allocations for checked-out residents and record reconciliation."
  }

  return "Manual operational maintenance job."
}

function humanizeJobName(name: string) {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
