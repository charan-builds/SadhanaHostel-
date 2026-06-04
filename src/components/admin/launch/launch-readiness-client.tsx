"use client"

import Link from "next/link"
import type { Route } from "next"
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  LifeBuoy,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime, humanizeEnum } from "@/lib/format"
import { useLaunchDiagnostics } from "@/hooks"
import type { LaunchCheckStatus } from "@/types/launch"

export function LaunchReadinessClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const diagnostics = useLaunchDiagnostics({
    organizationId,
    hostelId,
  })

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  if (diagnostics.isError) {
    return (
      <APIErrorState
        title="Launch diagnostics failed"
        error={diagnostics.error}
        onRetry={() => void diagnostics.refetch()}
      />
    )
  }

  const data = diagnostics.data
  const failures = data?.checks.filter((check) => check.status === "fail").length ?? 0
  const warnings = data?.checks.filter((check) => check.status === "warn").length ?? 0

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Launch Readiness"
        description="Maintenance-mode status, environment checks, payment safety, support alerts, and rollback controls for keeping the website stable."
        badge={data?.launchConfig.mode ? humanizeEnum(data.launchConfig.mode) : "Checking"}
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={diagnostics.isFetching}
            onClick={() => void diagnostics.refetch()}
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Blocking Checks"
          value={failures}
          description="Must be zero before pilot"
          icon={AlertTriangle}
          tone={failures > 0 ? "danger" : "success"}
        />
        <StatCard
          title="Warnings"
          value={warnings}
          description="Needs owner acceptance"
          icon={ClipboardCheck}
          tone={warnings > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Feature Flags"
          value={data?.launchConfig.featureFlags.enabled.length ?? 0}
          description="Enabled safety modules"
          icon={ShieldCheck}
          tone="info"
        />
        <StatCard
          title="Maintenance"
          value={data?.launchConfig.maintenance.enabled ? "On" : "Off"}
          description={data?.launchConfig.maintenance.bypassConfigured ? "Bypass configured" : "No bypass token"}
          icon={Activity}
          tone={data?.launchConfig.maintenance.enabled ? "warning" : "success"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Readiness Checks</CardTitle>
            <CardDescription>
              Launch blockers and warnings from environment, storage, cron, support, and safeguards.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {diagnostics.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading diagnostics...</p>
            ) : data?.checks.length ? (
              data.checks.map((check) => (
                <article key={check.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{check.label}</h2>
                    <StatusPill status={check.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{check.description}</p>
                  {check.action ? (
                    <p className="mt-2 text-sm font-medium">{check.action}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState
                title="No diagnostics available"
                message="Diagnostics will appear after the launch-readiness API responds."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rollback Controls</CardTitle>
            <CardDescription>
              Operational controls for pausing or reversing a controlled rollout.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ActionLink href="/admin/operations/automation" label="Pause automation jobs" />
            <ActionLink href="/admin/alerts" label="Review support blockers" />
            <ActionLink href="/admin/finance/payment-security" label="Verify payment safety" />
            <ActionLink href="/admin/settings" label="Review hostel settings" />
            <div className="grid gap-2 rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Cron jobs</span>
                <StatusPill
                  status={data?.launchConfig.safeguards.cronJobsEnabled ? "pass" : "warn"}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Emergency repairs</span>
                <StatusPill
                  status={
                    data?.launchConfig.safeguards.operationalRepairsEnabled ? "pass" : "warn"
                  }
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
              Use `MAINTENANCE_MODE=true` to pause user traffic, then roll back Vercel to the last healthy deployment if the issue is release-related.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Launch Metrics</CardTitle>
          <CardDescription>
            Daily operating metrics for resident activation, profile access, payments, and dues.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {data?.metrics.map((metric) => (
            <article key={metric.label} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <StatusPill status={metric.status} />
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {metric.unit === "INR"
                  ? formatCurrency(metric.value)
                  : `${metric.value}${metric.unit ?? ""}`}
              </p>
              {metric.target ? (
                <p className="mt-2 text-xs text-muted-foreground">{metric.target}</p>
              ) : null}
            </article>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>Environment-driven launch controls visible to operators.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FlagList title="Enabled" flags={data?.launchConfig.featureFlags.enabled ?? []} />
            <FlagList title="Disabled" flags={data?.launchConfig.featureFlags.disabled ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator Guides</CardTitle>
            <CardDescription>Runbooks for the launch window and first 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <GuideItem label="Soft-launch checklist" file="docs/launch/soft-launch-checklist.md" />
            <GuideItem label="Support handbook" file="docs/operations/support-handbook.md" />
            <GuideItem label="Incident response guide" file="docs/operations/incident-response-guide.md" />
            <GuideItem label="Maintenance and incident guide" file="docs/operations/incident-response-guide.md" />
            <GuideItem label="Final hardening runbook" file="docs/launch/final-production-hardening-runbook.md" />
            <p className="pt-2 text-xs text-muted-foreground">
              Last checked {data?.generatedAt ? formatDateTime(data.generatedAt) : "-"}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: LaunchCheckStatus }) {
  const variant = status === "fail" ? "destructive" : status === "warn" ? "outline" : "secondary"

  return <Badge variant={variant}>{humanizeEnum(status)}</Badge>
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" className="justify-start">
      <Link href={href as Route}>
        <LifeBuoy className="size-4" aria-hidden="true" />
        {label}
      </Link>
    </Button>
  )
}

function GuideItem({ file, label }: { file: string; label: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{file}</p>
    </div>
  )
}

function FlagList({ title, flags }: { title: string; flags: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {flags.length ? (
          flags.map((flag) => (
            <Badge key={flag} variant="secondary">
              {humanizeEnum(flag)}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
    </div>
  )
}
