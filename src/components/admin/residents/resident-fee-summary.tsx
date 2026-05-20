import { CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import type { MockPayment, MockResident } from "@/types/frontend"

type ResidentFeeSummaryProps = {
  resident: MockResident
  payments: MockPayment[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ResidentFeeSummary({ resident, payments }: ResidentFeeSummaryProps) {
  const lastPayment = payments.find((payment) => payment.status === "paid")
  const pendingAmount = resident.paymentStatus === "paid" ? 0 : resident.feeAmount

  return (
    <section className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Fee Summary</p>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">
            {formatCurrency(resident.feeAmount)}
          </h2>
        </div>
        <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <CreditCard className="size-5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Monthly Fee
          </p>
          <p className="mt-1 text-sm font-medium">{formatCurrency(resident.feeAmount)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payment Status
          </p>
          <div className="mt-1">
            <StatusBadge status={resident.paymentStatus} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending Amount
          </p>
          <p className="mt-1 text-sm font-medium">{formatCurrency(pendingAmount)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last Payment
          </p>
          <p className="mt-1 text-sm font-medium">{lastPayment?.paidOn ?? "No payment yet"}</p>
        </div>
      </div>

      <Button type="button" variant="outline" className="mt-5 w-full">
        Record Payment Placeholder
      </Button>
    </section>
  )
}
