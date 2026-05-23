"use client"

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { Bot, Loader2, Play, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useAutomationDashboard,
  useRepairConsistency,
  useRunAutomation,
  useUpdateAutomationSettings,
} from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import type { AutomationJobConfig } from "@/types/operations"
import type { AutomationJobName } from "@/validations/operations.validation"

export function AdminAutomationClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const dashboard = useAutomationDashboard({
    organizationId: organizationId ?? undefined,
    hostelId,
  })
  const runAutomation = useRunAutomation()
  const repairConsistency = useRepairConsistency()
  const updateSettings = useUpdateAutomationSettings()

  async function runJob(name: string, dryRun: boolean) {
    if (!organizationId) {
      return
    }

    try {
      const result = await runAutomation.mutateAsync({
        organizationId,
        hostelId,
        name: name as AutomationJobName,
        dryRun,
        payload: defaultPayload(name),
      })
      await dashboard.refetch()
      toast.success(result.result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run automation job.")
    }
  }

  async function saveJob(job: AutomationJobConfig, next: {
    enabled: boolean
    cronSchedule: string
  }) {
    if (!organizationId) {
      return
    }

    try {
      await updateSettings.mutateAsync({
        organizationId,
        hostelId,
        name: job.name as AutomationJobName,
        enabled: next.enabled,
        cronSchedule: next.cronSchedule,
        dryRunOnly: false,
      })
      await dashboard.refetch()
      toast.success("Automation setting saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save automation setting.")
    }
  }

  async function recalculateOccupancy() {
    if (!organizationId || !hostelId) {
      toast.error("Choose an active hostel before recalculating occupancy.")
      return
    }

    try {
      const result = await repairConsistency.mutateAsync({
        organizationId,
        hostelId,
        action: "recalculate_occupancy",
        dryRun: false,
      })
      await dashboard.refetch()
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to recalculate occupancy.")
    }
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Setup required"
        message="Finish organization setup before automation can run safely."
        action={
          <Button asChild>
            <Link href={"/admin/setup" as Route}>Open setup</Link>
          </Button>
        }
      />
    )
  }

  if (dashboard.isError) {
    return (
      <APIErrorState
        title="Automation dashboard could not be loaded"
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
      />
    )
  }

  const consistency = dashboard.data?.consistency

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Operations Automation"
        description="Run and control recurring hostel operations: dues, reminders, reservation expiry, invite cleanup, occupancy, checkout reconciliation, and consistency scans."
        badge={consistency ? `Consistency ${consistency.score}/100` : undefined}
      />

      {dashboard.isLoading ? (
        <div className="rounded-xl border bg-background p-5 text-sm text-muted-foreground">
          Loading automation controls...
        </div>
      ) : null}

      {consistency ? (
        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Critical" value={consistency.summaries.critical} tone="danger" />
          <Metric label="High" value={consistency.summaries.high} tone="warning" />
          <Metric label="Medium" value={consistency.summaries.medium} tone="info" />
          <Metric label="Total findings" value={consistency.summaries.totalFindings} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Repair Occupancy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recompute vacancy from active residents, allocations, reservations, and maintenance blocks; flags orphan or duplicate occupancy records for review.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={repairConsistency.isPending}
          onClick={() => void recalculateOccupancy()}
        >
          {repairConsistency.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="size-4" aria-hidden="true" />
          )}
          Repair Occupancy
        </Button>
      </section>

      <DataTableShell
        title="Automation jobs"
        description="Disable risky jobs, adjust desired schedule metadata, run dry-run previews, or execute a job immediately."
      >
        <div className="divide-y">
          {dashboard.data?.jobs.map((job) => (
            <JobControl
              key={job.name}
              job={job}
              isRunning={runAutomation.isPending}
              isSaving={updateSettings.isPending}
              onRun={(dryRun) => void runJob(job.name, dryRun)}
              onSave={(next) => void saveJob(job, next)}
            />
          ))}
        </div>
      </DataTableShell>

      <DataTableShell
        title="Consistency findings"
        description="Issues found by the operational consistency scanner."
        empty={
          consistency?.findings.length === 0 ? (
            <EmptyState
              title="No consistency findings"
              message="The latest scan did not find stale reservations, orphan uploads, invoice mismatches, or over-capacity rooms."
            />
          ) : undefined
        }
      >
        <div className="divide-y">
          {consistency?.findings.map((finding) => (
            <article key={finding.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{finding.title}</h2>
                  <Badge variant={finding.severity === "critical" ? "destructive" : "secondary"}>
                    {humanizeEnum(finding.severity)}
                  </Badge>
                  <Badge variant="outline">{finding.count}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {finding.description}
                </p>
              </div>
              <Badge variant="outline">{humanizeEnum(finding.repairAction)}</Badge>
            </article>
          ))}
        </div>
      </DataTableShell>

      <DataTableShell
        title="Recent automation runs"
        description="Audit-backed run history from background job execution."
        empty={
          dashboard.data?.recentRuns.length === 0 ? (
            <EmptyState
              title="No automation runs yet"
              message="Run a dry-run preview or wait for the next scheduled cron execution."
            />
          ) : undefined
        }
      >
        <div className="divide-y">
          {dashboard.data?.recentRuns.map((run) => (
            <article key={run.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{run.jobName ?? "Background job"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(run.createdAt)}
                </p>
              </div>
              <StatusBadge status={run.status} />
            </article>
          ))}
        </div>
      </DataTableShell>
    </div>
  )
}

function JobControl({
  job,
  isRunning,
  isSaving,
  onRun,
  onSave,
}: {
  job: AutomationJobConfig
  isRunning: boolean
  isSaving: boolean
  onRun: (dryRun: boolean) => void
  onSave: (next: { enabled: boolean; cronSchedule: string }) => void
}) {
  const [schedule, setSchedule] = useState(job.schedule)

  return (
    <article className="grid gap-4 p-4 xl:grid-cols-[1fr_24rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Bot className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">{job.title}</h2>
          <Badge variant={job.enabled ? "secondary" : "destructive"}>
            {job.enabled ? "Enabled" : "Disabled"}
          </Badge>
          {job.destructive ? <Badge variant="outline">Changes data</Badge> : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{job.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Queue {job.queueName} · Current schedule {job.schedule}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] xl:grid-cols-1">
        <Input
          value={schedule}
          aria-label={`${job.title} schedule`}
          onChange={(event) => setSchedule(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onSave({ enabled: !job.enabled, cronSchedule: schedule })}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {job.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onSave({ enabled: job.enabled, cronSchedule: schedule })}
          >
            <Save className="size-4" />
            Save schedule
          </Button>
          <Button type="button" variant="outline" disabled={isRunning} onClick={() => onRun(true)}>
            <RotateCcw className="size-4" />
            Dry run
          </Button>
          <Button type="button" disabled={isRunning || !job.enabled} onClick={() => onRun(false)}>
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run now
          </Button>
        </div>
      </div>
    </article>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "danger" | "warning" | "info"
}) {
  const toneClass = {
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
  }[tone ?? "info"]

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function defaultPayload(name: string) {
  if (name === "monthly_fee_generation") {
    return { periodMonth: currentPeriodMonth() }
  }

  if (name === "payment_reminder") {
    return { dueBeforeDate: new Date().toISOString().slice(0, 10), limit: 100 }
  }

  if (name === "invoice_cleanup") {
    return { olderThanDays: 90 }
  }

  if (name === "stale_upload_cleanup") {
    return { olderThanHours: 24 }
  }

  if (name === "onboarding_aging") {
    return { olderThanDays: 7, limit: 100 }
  }

  return {}
}

function currentPeriodMonth() {
  const now = new Date()

  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`
}
