"use client"

import { useMemo } from "react"
import { Loader2, RefreshCcw, ShieldCheck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { humanizeEnum } from "@/lib/format"
import { useRegenerateMissingReceipts, useRepairFinancialReconciliation } from "@/hooks"
import type { FinancialReconciliationCounts } from "@/types/operations"

export function AdminReconciliationClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const repair = useRepairFinancialReconciliation()
  const receipts = useRegenerateMissingReceipts()
  const latestCounts = useMemo(() => {
    return repair.data?.before ?? receipts.data?.before ?? null
  }, [receipts.data?.before, repair.data?.before])

  if (!organizationId) {
    return (
      <ResponsiveContainer size="wide" className="py-8">
        <EmptyState title="Tenant context resolving" message="Finance context is loading." />
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 py-8">
      <PageHeader
        title="Reconciliation"
        description="Run finance-safe dry-run checks for invoices, receipts, and payment matching."
        badge="Dry-run only"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={repair.isPending}
              onClick={() =>
                void repair.mutateAsync({
                  organizationId,
                  hostelId,
                  action: "repair_all",
                  dryRun: true,
                })
              }
            >
              {repair.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw className="size-4" aria-hidden="true" />
              )}
              Run Reconciliation Check
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={receipts.isPending}
              onClick={() =>
                void receipts.mutateAsync({
                  organizationId,
                  hostelId,
                  dryRun: true,
                  limit: 100,
                })
              }
            >
              {receipts.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="size-4" aria-hidden="true" />
              )}
              Check Missing Receipts
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ReconciliationMetric
          label="Payments Missing Invoice"
          value={latestCounts?.verified_payments_missing_invoice ?? 0}
        />
        <ReconciliationMetric
          label="Payments Missing Receipt"
          value={latestCounts?.verified_payments_missing_receipt ?? 0}
        />
        <ReconciliationMetric
          label="Paid Dues Missing Invoice"
          value={latestCounts?.paid_zero_balance_fee_records_missing_invoice ?? 0}
        />
        <ReconciliationMetric
          label="Receipt Link Issues"
          value={latestCounts?.verified_receipt_documents_missing_invoice_link ?? 0}
        />
        <ReconciliationMetric
          label="Invoice Total Mismatch"
          value={latestCounts?.paid_invoice_payment_total_mismatch ?? 0}
        />
      </section>

      <ResultPanel title="Reconciliation Dry Run" report={repair.data} />
      <ResultPanel title="Receipt Dry Run" report={receipts.data} />
    </ResponsiveContainer>
  )
}

function ReconciliationMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-soft">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <Badge className="mt-3" variant={value === 0 ? "secondary" : "destructive"}>
        {value === 0 ? "Clear" : "Review"}
      </Badge>
    </article>
  )
}

function ResultPanel({
  title,
  report,
}: {
  title: string
  report?: {
    dryRun: boolean
    message: string
    before: FinancialReconciliationCounts
    after: FinancialReconciliationCounts
  }
}) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {report ? <Badge variant="secondary">{report.dryRun ? "Dry run" : "Executed"}</Badge> : null}
      </div>
      {!report ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Run a dry-run check to load reconciliation evidence.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          <p className="text-sm text-muted-foreground">{report.message}</p>
          {Object.entries(report.before).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2 text-sm">
              <span>{humanizeEnum(key)}</span>
              <span className="font-semibold">{value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
