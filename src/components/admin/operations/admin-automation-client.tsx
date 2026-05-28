"use client"

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { AlertTriangle, Bot, Fingerprint, Loader2, Play, RotateCcw, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTableShell } from "@/components/shared/data-table-shell"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useAutomationDashboard,
  useIdentityReconciliation,
  useRepairConsistency,
  useRepairIdentities,
  useResetDemoData,
  useRunAutomation,
  useUpdateAutomationSettings,
} from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import type {
  AutomationJobConfig,
  ConsistencyFinding,
  DemoDataResetReport,
  IdentityReconciliationFinding,
} from "@/types/operations"
import type { AutomationJobName } from "@/validations/operations.validation"

const DEMO_RESET_CONFIRMATION = "RESET DEMO DATA"

export function AdminAutomationClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [resetConfirmation, setResetConfirmation] = useState("")
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetReport, setResetReport] = useState<DemoDataResetReport | null>(null)
  const dashboard = useAutomationDashboard({
    organizationId: organizationId ?? undefined,
    hostelId,
  })
  const runAutomation = useRunAutomation()
  const repairConsistency = useRepairConsistency()
  const updateSettings = useUpdateAutomationSettings()
  const resetDemoData = useResetDemoData()
  const identityReport = useIdentityReconciliation({
    organizationId: organizationId ?? undefined,
    hostelId,
  })
  const repairIdentities = useRepairIdentities()
  const canResetDemoData = Boolean(
    session?.roles.some((role) => role === "owner" || role === "super_admin")
  )

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

  async function runConsistencyRepair(
    action: ConsistencyFinding["repairAction"],
    dryRun = false
  ) {
    if (!organizationId) {
      toast.error("Choose an organization before running consistency repair.")
      return
    }

    if (action === "review_manually") {
      toast.info("This finding needs operator review before repair.")
      return
    }

    if (
      !hostelId &&
      (action === "recalculate_occupancy" || action === "release_stale_allocations")
    ) {
      toast.error("Choose an active hostel before repairing occupancy.")
      return
    }

    try {
      const result = await repairConsistency.mutateAsync({
        organizationId,
        hostelId,
        action,
        dryRun,
      })
      await dashboard.refetch()
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process consistency repair.")
    }
  }

  async function runDemoDataReset(dryRun: boolean) {
    if (!organizationId) {
      toast.error("Choose an organization before resetting demo data.")
      return
    }

    if (!canResetDemoData) {
      toast.error("Only hostel owners can reset demo/test operational data.")
      return
    }

    try {
      const result = await resetDemoData.mutateAsync({
        organizationId,
        hostelId,
        dryRun,
        confirmation: dryRun ? undefined : resetConfirmation,
      })

      setResetReport(result)
      await dashboard.refetch()
      toast.success(
        dryRun
          ? "Reset preview is ready."
          : "Demo/test resident data was reset safely."
      )
      if (!dryRun) {
        setResetConfirmation("")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset demo data.")
    }
  }

  async function runIdentityRepair(dryRun: boolean) {
    if (!organizationId) {
      toast.error("Choose an organization before running identity repair.")
      return
    }

    try {
      const result = await repairIdentities.mutateAsync({
        organizationId,
        hostelId,
        action: "repair_safe",
        dryRun,
      })
      await Promise.all([dashboard.refetch(), identityReport.refetch()])
      toast.success(
        dryRun
          ? `${result.deletedAuthUsers} orphan auth identity repair(s) are safe to apply.`
          : `Identity repair completed. ${result.deletedAuthUsers} orphan auth identity(s) removed.`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run identity repair.")
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
        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Metric label="Critical" value={consistency.summaries.critical} tone="danger" />
          <Metric label="High" value={consistency.summaries.high} tone="warning" />
          <Metric label="Medium" value={consistency.summaries.medium} tone="info" />
          <Metric label="Informational" value={consistency.summaries.informational ?? consistency.summaries.low} />
          <Metric label="Total findings" value={consistency.summaries.totalFindings} />
        </section>
      ) : null}

      <section className="grid gap-4 rounded-lg border bg-background p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Fingerprint className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Identity Repair</h2>
              {identityReport.data ? (
                <Badge variant={identityReport.data.summaries.critical > 0 ? "destructive" : "outline"}>
                  {identityReport.data.summaries.totalFindings} finding(s)
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Detect stale Supabase Auth users, internal resident aliases, duplicate phone identities,
              missing resident links, and onboarding auth drift after reset or repeated activation testing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={identityReport.isFetching}
              onClick={() => void identityReport.refetch()}
            >
              {identityReport.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-4" aria-hidden="true" />
              )}
              Scan identities
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={repairIdentities.isPending}
              onClick={() => void runIdentityRepair(true)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Dry run repair
            </Button>
            <Button
              type="button"
              disabled={
                repairIdentities.isPending ||
                !identityReport.data?.summaries.safeAutoRepairs
              }
              onClick={() => void runIdentityRepair(false)}
            >
              {repairIdentities.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Fingerprint className="size-4" aria-hidden="true" />
              )}
              Remove auth ghosts
            </Button>
          </div>
        </div>

        {identityReport.data ? (
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Critical identity issues" value={identityReport.data.summaries.critical} tone="danger" />
            <Metric label="High identity issues" value={identityReport.data.summaries.high} tone="warning" />
            <Metric label="Safe auth cleanups" value={identityReport.data.summaries.safeAutoRepairs} />
            <Metric label="Auth users scanned" value={identityReport.data.scannedAuthUsers} />
          </div>
        ) : null}

        {identityReport.data?.findings.length ? (
          <div className="divide-y rounded-md border">
            {identityReport.data.findings.slice(0, 6).map((finding) => (
              <IdentityFindingRow key={finding.id} finding={finding} />
            ))}
            {identityReport.data.findings.length > 6 ? (
              <p className="p-3 text-xs text-muted-foreground">
                {identityReport.data.findings.length - 6} more identity finding(s) are included in the scan response.
              </p>
            ) : null}
          </div>
        ) : identityReport.isLoading ? (
          <p className="text-sm text-muted-foreground">Scanning resident identity state...</p>
        ) : (
          <EmptyState
            title="No identity drift detected"
            message="Resident auth identities, public users, onboarding state, and resident links are synchronized for this scope."
          />
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Repair Occupancy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Close invalid active allocations, repair duplicate room assignments, and recompute vacancy from active residents, reservations, and maintenance blocks.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={repairConsistency.isPending}
          onClick={() => void runConsistencyRepair("release_stale_allocations")}
        >
          {repairConsistency.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="size-4" aria-hidden="true" />
          )}
          Repair Occupancy
        </Button>
      </section>

      <section className="grid gap-4 rounded-lg border border-destructive/30 bg-background p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Reset Demo/Test Data</h2>
              <Badge variant={canResetDemoData ? "outline" : "destructive"}>
                Owner only
              </Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Clear resident operations for a fresh staging/UAT cycle while preserving admin access,
              organizations, hostels, rooms, payment QR/settings, CMS, gallery, notices, feature flags,
              and automation settings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canResetDemoData || resetDemoData.isPending}
              onClick={() => void runDemoDataReset(true)}
            >
              {resetDemoData.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-4" aria-hidden="true" />
              )}
              Preview reset
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !canResetDemoData ||
                resetDemoData.isPending ||
                resetConfirmation !== DEMO_RESET_CONFIRMATION
              }
              onClick={() => setResetDialogOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Reset demo data
            </Button>
          </div>
        </div>

        <div className="grid gap-2 md:max-w-xl">
          <label htmlFor="demo-reset-confirmation" className="text-sm font-medium">
            Confirmation phrase
          </label>
          <Input
            id="demo-reset-confirmation"
            value={resetConfirmation}
            disabled={!canResetDemoData || resetDemoData.isPending}
            placeholder={DEMO_RESET_CONFIRMATION}
            onChange={(event) => setResetConfirmation(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Type {DEMO_RESET_CONFIRMATION} after reviewing the dry-run counts. This does not remove
            owners, admins, staff, hostel setup, rooms, payment QR, or website configuration.
          </p>
        </div>

        {resetReport ? <DemoDataResetReportView report={resetReport} /> : null}
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
                {finding.details?.length ? (
                  <div className="mt-3 space-y-2">
                    {finding.details.slice(0, 5).map((detail, index) => (
                      <div
                        key={`${detail.tableName}-${detail.recordId ?? index}-${detail.anomalyType}`}
                        className="rounded-md border bg-muted/30 p-3 text-xs"
                      >
                        <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium">
                          <span>{detail.tableName}</span>
                          <span>{detail.anomalyType}</span>
                          <span className="font-mono">{detail.recordId ?? "record unavailable"}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          Resident {detail.residentId ?? "not linked"} · Organization{" "}
                          {detail.organizationId ?? detail.actualOrganizationId ?? "unknown"} · Hostel{" "}
                          {detail.hostelId ?? detail.actualHostelId ?? "unknown"}.
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Expected: {detail.expectedState ?? detail.expectedHostelId ?? "known safe state"}.
                          {" "}Actual: {detail.actualState ?? detail.actualHostelId ?? "unsafe state"}.
                        </p>
                        <p className="mt-1 text-muted-foreground">{detail.recommendation}</p>
                      </div>
                    ))}
                    {finding.details.length > 5 ? (
                      <p className="text-xs text-muted-foreground">
                        {finding.details.length - 5} more record-level issue(s) are included in the audit log.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <Badge variant="outline">{humanizeEnum(finding.repairAction)}</Badge>
                {finding.repairAction !== "review_manually" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={repairConsistency.isPending}
                    onClick={() => void runConsistencyRepair(finding.repairAction, true)}
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Dry run
                  </Button>
                ) : null}
                {finding.repairAction !== "review_manually" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={repairConsistency.isPending}
                    onClick={() => void runConsistencyRepair(finding.repairAction)}
                  >
                    {repairConsistency.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                    )}
                    Repair now
                  </Button>
                ) : null}
              </div>
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

      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset resident demo/test data?"
        description="This permanently removes residents, invites, onboarding records, allocations, payments, invoices, leads, reservations, resident notifications, linked resident auth users, and private resident/payment files for the selected tenant scope. Admin access and configuration are preserved."
        confirmLabel={resetDemoData.isPending ? "Resetting..." : "Reset demo data"}
        variant="danger"
        onConfirm={() => void runDemoDataReset(false)}
      />
    </div>
  )
}

function DemoDataResetReportView({ report }: { report: DemoDataResetReport }) {
  const totalRows = Object.values(report.rows).reduce((total, value) => total + value, 0)
  const rowEntries = Object.entries(report.rows).filter(([, value]) => value > 0)

  return (
    <div className="grid gap-4 rounded-md border bg-muted/25 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={report.dryRun ? "dry run" : "executed"} />
        <Badge variant="outline">{totalRows} database row(s)</Badge>
        <Badge variant="outline">{report.storageObjects.length} file(s)</Badge>
        <Badge variant="outline">{report.authUsers.length} resident auth user(s)</Badge>
        {report.auditId ? <Badge variant="secondary">Audit logged</Badge> : null}
      </div>

      {rowEntries.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {rowEntries.map(([key, value]) => (
            <div key={key} className="rounded-md border bg-background p-3">
              <p className="text-xs text-muted-foreground">{humanizeEnum(key)}</p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No resident/test operational records were found in this tenant scope.
        </p>
      )}

      {!report.dryRun ? (
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>Storage files removed: {report.storageDeleted ?? 0}</p>
          <p>Resident auth users removed: {report.authUsersDeleted ?? 0}</p>
        </div>
      ) : null}

      {report.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Review before launch</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function IdentityFindingRow({ finding }: { finding: IdentityReconciliationFinding }) {
  return (
    <article className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto] md:items-start">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{finding.title}</p>
          <Badge variant={finding.severity === "critical" ? "destructive" : "secondary"}>
            {humanizeEnum(finding.severity)}
          </Badge>
          {finding.safeAutoRepair ? <Badge variant="outline">Safe repair</Badge> : null}
        </div>
        <p className="mt-1 text-muted-foreground">{finding.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Resident {finding.residentId ?? "not linked"} · Auth{" "}
          {finding.authUserId ?? "not linked"} · Hostel {finding.hostelId ?? "all hostels"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Expected: {finding.expectedState} Actual: {finding.actualState}
        </p>
      </div>
      <Badge variant="outline">{humanizeEnum(finding.recommendedRepairAction)}</Badge>
    </article>
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
