"use client"

import { useMemo, useState } from "react"
import { Download, ReceiptText, Search } from "lucide-react"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { filterCollectionRows } from "@/lib/finance/collection-center"
import type { ResidentFinanceSummary } from "@/lib/finance/finance-dashboard"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate, formatDateTime, humanizeEnum } from "@/lib/format"
import { useFinanceDashboard, useInvoiceDownloadUrl, useResidentPaymentLedger } from "@/hooks"
import type { Tables } from "@/types/database"

export function AdminReceiptsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [search, setSearch] = useState("")
  const [selectedRow, setSelectedRow] = useState<ResidentFinanceSummary | null>(null)
  const dashboard = useFinanceDashboard(
    organizationId
      ? {
          organizationId,
          hostelId,
        }
      : undefined
  )
  const finance = dashboard.data
  const filteredRows = useMemo(
    () => filterCollectionRows(finance?.residentFinance ?? [], search),
    [finance?.residentFinance, search]
  )
  const residentById = useMemo(
    () => new Map((finance?.residentFinance ?? []).map((row) => [row.resident.id, row])),
    [finance?.residentFinance]
  )

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
        title="Receipts"
        description="Find recent collections and open resident receipt history on demand."
        badge={`${finance?.recentPayments.length ?? 0} recent`}
      />

      {dashboard.isLoading ? <LoadingState variant="dashboard" /> : null}
      {dashboard.isError ? (
        <APIErrorState
          title="Receipts could not be loaded"
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}

      {finance ? (
        <>
          <section className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Search resident, invoice, receipt, transaction reference"
                aria-label="Search receipts"
              />
            </div>
          </section>

          <section className="rounded-xl border bg-card shadow-soft">
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">Recent Collections</h2>
            </div>
            <div className="divide-y">
              {finance.recentPayments.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No receipts" message="Verified collection receipts appear here." />
                </div>
              ) : (
                finance.recentPayments.map((payment) => {
                  const row = residentById.get(payment.resident_id)

                  if (search && row && !filteredRows.some((item) => item.resident.id === row.resident.id)) {
                    return null
                  }

                  return (
                    <article key={payment.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-semibold">{row?.resident.full_name ?? "Resident"}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(payment.amount)} · {humanizeEnum(payment.method)} ·{" "}
                          {formatDateTime(payment.verified_at ?? payment.paid_at ?? payment.created_at)}
                        </p>
                      </div>
                      {row ? (
                        <Button type="button" variant="outline" onClick={() => setSelectedRow(row)}>
                          <ReceiptText className="size-4" aria-hidden="true" />
                          View Receipts
                        </Button>
                      ) : null}
                    </article>
                  )
                })
              )}
            </div>
          </section>
        </>
      ) : null}

      <ReceiptDrawer
        row={selectedRow}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRow(null)
          }
        }}
      />
    </ResponsiveContainer>
  )
}

function ReceiptDrawer({
  row,
  onOpenChange,
}: {
  row: ResidentFinanceSummary | null
  onOpenChange: (open: boolean) => void
}) {
  const ledger = useResidentPaymentLedger(
    row
      ? {
          organizationId: row.resident.organization_id,
          residentId: row.resident.id,
        }
      : undefined
  )
  const downloadInvoice = useInvoiceDownloadUrl()
  const receipts = (ledger.data?.invoices ?? []).filter(
    (invoice) => invoice.status === "paid" || invoice.paid_amount > 0
  )

  async function download(invoice: Tables<"invoices">) {
    const result = await downloadInvoice.mutateAsync({
      organizationId: invoice.organization_id,
      invoiceId: invoice.id,
      expiresInSeconds: 900,
    })

    window.open(result.downloadUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {row ? (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>{row.resident.full_name}</SheetTitle>
              <SheetDescription>
                {row.resident.admission_number} · {row.receiptNumbers.length} receipt references
              </SheetDescription>
            </SheetHeader>
            <div className="mt-5 grid gap-3">
              {ledger.isLoading ? <LoadingState variant="cards" /> : null}
              {!ledger.isLoading && receipts.length === 0 ? (
                <EmptyState title="No receipts" message="Verified payment receipts will appear here." />
              ) : null}
              {receipts.map((invoice) => (
                <article key={invoice.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
                  <div>
                    <p className="font-semibold">{invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(invoice.total_amount)} · {formatDate(invoice.issue_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={invoice.status} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!invoice.pdf_storage_path || downloadInvoice.isPending}
                      onClick={() => void download(invoice)}
                    >
                      <Download className="size-4" aria-hidden="true" />
                      Download
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
