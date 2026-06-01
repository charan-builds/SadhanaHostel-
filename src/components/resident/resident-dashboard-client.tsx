"use client"

import Link from "next/link"
import type { Route } from "next"
import { CalendarDays, CreditCard, FileText, User, type LucideIcon } from "lucide-react"

import { LoadingState } from "@/components/shared/loading-state"
import { MotionReveal } from "@/components/shared/motion-reveal"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { useCurrentResident, useLeaves, usePayments, useNotices } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/format"

export function ResidentDashboardClient() {
  const { organizationId, session } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const hostelId = resident.data?.hostel_id ?? session?.hostelIds[0]
  const payments = usePayments({
    organizationId: organizationId ?? "",
    hostelId,
    residentId: resident.data?.id,
    page: 1,
    pageSize: 5,
  })
  const leaves = useLeaves({
    organizationId: organizationId ?? "",
    hostelId,
    residentId: resident.data?.id,
    page: 1,
    pageSize: 5,
  })
  const notices = useNotices({
    organizationId: organizationId ?? "",
    hostelId,
    activeOnly: true,
    page: 1,
    pageSize: 5,
  })

  if (!organizationId) {
    return <EmptyState title="Organization access pending" message="Ask an admin to complete your account assignment." />
  }

  if (resident.isLoading) {
    return <LoadingState variant="cards" />
  }

  if (resident.error || !resident.data) {
    return (
      <APIErrorState
        title="Profile not linked"
        message="Your login is not connected to a resident record yet."
        onRetry={() => void resident.refetch()}
      />
    )
  }

  const latestPayment = payments.data?.data[0]
  const latestLeave = leaves.data?.data[0]
  const pendingAmount =
    payments.data?.data.some((payment) => payment.status === "verified")
      ? 0
      : resident.data.monthly_fee_amount

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Welcome, ${resident.data.preferred_name || resident.data.full_name}`}
        description="Your room, fees, leave status, notices, and profile completion in one place."
        actions={
          <Button asChild>
            <Link href={"/resident/payments" as Route}>
              <CreditCard className="size-4" aria-hidden="true" />
              Pay Fees
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResidentMetric
          icon={User}
          label="Profile"
          value={resident.data.status}
          detail={resident.data.aadhaar_document_id ? "Documents started" : "Aadhaar pending"}
        />
        <ResidentMetric
          icon={CreditCard}
          label="Estimated Due"
          value={formatCurrency(pendingAmount)}
          detail={latestPayment ? `Last payment ${formatDate(latestPayment.created_at)}` : "No payment history yet"}
        />
        <ResidentMetric
          icon={CalendarDays}
          label="Leave Status"
          value={latestLeave?.status ?? "None"}
          detail={latestLeave ? `${formatDate(latestLeave.from_date)} to ${formatDate(latestLeave.to_date)}` : "No leave requests"}
        />
        <ResidentMetric
          icon={FileText}
          label="Notices"
          value={notices.data?.meta.total ?? 0}
          detail="Active hostel announcements"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <QuickAction href="/resident/profile" title="Complete profile" description="Update contacts and upload documents." />
        <QuickAction href="/resident/payments" title="Submit UPI payment" description="Enter reference and upload proof." />
        <QuickAction href="/resident/leave" title="Apply leave" description="Submit dates, reason, destination, and travel mode." />
      </section>
    </div>
  )
}

function ResidentMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  detail: string
}) {
  return (
    <MotionReveal>
    <article className="saas-surface motion-lift group rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-105">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-2">
        {typeof value === "string" ? <StatusBadge status={value} /> : <p className="text-2xl font-semibold">{value}</p>}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
    </article>
    </MotionReveal>
  )
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: Route
  title: string
  description: string
}) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start p-4 text-left">
      <Link href={href}>
        <span>
          <span className="block font-medium">{title}</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{description}</span>
        </span>
      </Link>
    </Button>
  )
}
