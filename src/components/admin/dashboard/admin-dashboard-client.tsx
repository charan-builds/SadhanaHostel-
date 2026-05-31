"use client"

import Link from "next/link"
import type { Route } from "next"
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  FileCheck2,
  IndianRupee,
  KeyRound,
  Plus,
  UserCheck,
  UserRoundPlus,
  Users,
} from "lucide-react"

import { APIErrorState, EmptyState } from "@/components/system"
import { DataTableShell } from "@/components/shared/data-table-shell"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/format"
import { useRealtimeAdmissions, useRealtimeLeaves, useRealtimePayments } from "@/lib/realtime"
import { useDashboardAnalytics, useLeaves, usePayments, useResidents, useRooms } from "@/hooks"

export function AdminDashboardClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  useRealtimeAdmissions({ enabled: Boolean(organizationId) })
  useRealtimePayments({ enabled: Boolean(organizationId) })
  useRealtimeLeaves({ enabled: Boolean(organizationId) })
  const analytics = useDashboardAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
  })
  const residents = useResidents({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 5,
  })
  const rooms = useRooms({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 5,
  })
  const payments = usePayments({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 5,
  })
  const leaves = useLeaves({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 5,
  })

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  if (analytics.isLoading) {
    return <LoadingState variant="dashboard" />
  }

  if (analytics.error) {
    return (
      <APIErrorState
        title="Dashboard failed to load"
        message="Unable to load dashboard analytics."
        onRetry={() => void analytics.refetch()}
      />
    )
  }

  const metrics = analytics.data
  const lifecycle = metrics?.residentLifecycle
  const operationalAlerts = buildOperationalAlerts({
    registeredResidents: metrics?.totalResidents ?? residents.data?.meta.total ?? 0,
    onboardingResidents: lifecycle?.onboardingResidents ?? 0,
    pendingVerification: metrics?.operations.pendingVerification ?? 0,
    pendingPayments: metrics?.finance.pendingPayments ?? 0,
    newAdmissions: metrics?.operations.newAdmissions ?? 0,
    pendingInvites: metrics?.operations.pendingInvites ?? 0,
    vacantBeds: metrics?.occupancy.vacantBeds ?? 0,
    capacity: metrics?.occupancy.capacity ?? 0,
    roomsConfigured: rooms.data?.meta.total ?? 0,
  })

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Admin Dashboard"
        description="Operational overview for student lifecycle, room occupancy, payments, admissions, and verification work."
        actions={
          <>
            <Button asChild>
              <Link href={"/admin/residents/new" as Route}>
                <Plus className="size-4" aria-hidden="true" />
                Add Resident
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={"/admin/reports" as Route}>
                <BarChart3 className="size-4" aria-hidden="true" />
                View Reports
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Registered Residents"
          value={metrics?.totalResidents ?? residents.data?.meta.total ?? 0}
          description="All non-deleted resident records"
          icon={Users}
          tone="info"
        />
        <StatCard
          title="Active Residents"
          value={lifecycle?.activeResidents ?? 0}
          description="Verified residents in active lifecycle"
          icon={UserCheck}
          tone="success"
        />
        <StatCard
          title="Draft / Onboarding"
          value={lifecycle?.onboardingResidents ?? 0}
          description="Need invite, profile, or document action"
          icon={UserRoundPlus}
          tone={lifecycle?.onboardingResidents ? "warning" : "success"}
        />
        <StatCard
          title="Occupied Students"
          value={`${metrics?.occupancy.occupiedBeds ?? 0}/${metrics?.occupancy.capacity ?? 0}`}
          description={`${Math.round(metrics?.occupancy.occupancyRate ?? 0)}% active occupancy`}
          icon={Users}
          tone="info"
        />
        <StatCard
          title="Vacancy"
          value={metrics?.occupancy.vacantBeds ?? 0}
          description={`${rooms.data?.meta.total ?? 0} configured rooms`}
          icon={Building2}
          tone={(metrics?.occupancy.vacantBeds ?? 0) > 2 ? "success" : "warning"}
        />
        <StatCard
          title="Pending Verification"
          value={metrics?.operations.pendingVerification ?? 0}
          description="Documents or onboarding need review"
          icon={FileCheck2}
          tone={metrics?.operations.pendingVerification ? "warning" : "success"}
        />
        <StatCard
          title="Pending Dues"
          value={formatCurrency(metrics?.finance.pendingDues ?? 0)}
          description="Outstanding balances"
          icon={CreditCard}
          tone="warning"
        />
        <StatCard
          title="Pending Payments"
          value={metrics?.finance.pendingPayments ?? 0}
          description="UPI proofs waiting for finance review"
          icon={CreditCard}
          tone={metrics?.finance.pendingPayments ? "warning" : "success"}
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(metrics?.finance.monthlyRevenue ?? 0)}
          description="Verified collections this month"
          icon={IndianRupee}
          tone="success"
        />
        <StatCard
          title="Active Leaves"
          value={metrics?.operations.activeLeaves ?? 0}
          description="Approved residents currently away"
          icon={CalendarDays}
          tone={metrics?.operations.activeLeaves ? "warning" : "success"}
        />
        <StatCard
          title="New Admissions"
          value={metrics?.operations.newAdmissions ?? 0}
          description="Open leads that need follow-up"
          icon={UserRoundPlus}
          tone={metrics?.operations.newAdmissions ? "warning" : "success"}
        />
        <StatCard
          title="Pending Invites"
          value={metrics?.operations.pendingInvites ?? 0}
          description="Residents not activated yet"
          icon={KeyRound}
          tone={metrics?.operations.pendingInvites ? "warning" : "success"}
        />
      </section>

      {operationalAlerts.length > 0 ? (
        <section className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Operational Attention</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {operationalAlerts.map((alert) => (
              <Link
                key={alert.title}
                href={alert.href as Route}
                className="rounded-md border p-3 text-sm transition-colors hover:bg-muted/60"
              >
                <p className="font-medium text-foreground">{alert.title}</p>
                <p className="mt-1 text-muted-foreground">{alert.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <DataTableShell
          title="Recent Payments"
          description="Latest payment records from the production API."
          empty={
            payments.data?.data.length === 0 ? (
              <EmptyState title="No payments yet" message="Payments will appear here after residents submit or admins record them." />
            ) : undefined
          }
        >
          {payments.isLoading ? (
            <LoadingState variant="table" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.data?.data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.id.slice(0, 8)}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="capitalize">{payment.method.replace("_", " ")}</TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell>{formatDate(payment.paid_at ?? payment.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTableShell>

        <DataTableShell
          title="Recent Leave Requests"
          description="Latest resident leave activity."
          empty={
            leaves.data?.data.length === 0 ? (
              <EmptyState title="No leave requests" message="Resident leave requests will appear here." />
            ) : undefined
          }
        >
          {leaves.isLoading ? (
            <LoadingState variant="table" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Return</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.data?.data.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell className="font-medium">{leave.resident_id.slice(0, 8)}</TableCell>
                    <TableCell>{formatDate(leave.from_date)}</TableCell>
                    <TableCell>{formatDate(leave.to_date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={leave.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTableShell>
      </section>
    </ResponsiveContainer>
  )
}

function buildOperationalAlerts(input: {
  registeredResidents: number
  onboardingResidents: number
  pendingVerification: number
  pendingPayments: number
  newAdmissions: number
  pendingInvites: number
  vacantBeds: number
  capacity: number
  roomsConfigured: number
}) {
  const alerts: Array<{ title: string; description: string; href: string }> = []

  if (input.roomsConfigured === 0 || input.capacity === 0) {
    alerts.push({
      title: "Room inventory is not configured",
      description: "Create rooms and student capacity before admitting residents.",
      href: "/admin/rooms",
    })
  }

  if (input.onboardingResidents > 0) {
    alerts.push({
      title: `${input.onboardingResidents} resident${input.onboardingResidents === 1 ? "" : "s"} in onboarding`,
      description: "Draft or invited residents are registered but do not count as occupied students yet.",
      href: "/admin/residents",
    })
  }

  if (input.pendingVerification > 0) {
    alerts.push({
      title: `${input.pendingVerification} verification review${input.pendingVerification === 1 ? "" : "s"} pending`,
      description: "Review documents so verified residents can access full hostel workflows.",
      href: "/admin/residents/verification",
    })
  }

  if (input.pendingPayments > 0) {
    alerts.push({
      title: `${input.pendingPayments} payment request${input.pendingPayments === 1 ? "" : "s"} pending`,
      description: "Open the finance queue to approve, reject, or request corrected proof.",
      href: "/admin/payments",
    })
  }

  if (input.newAdmissions > 0) {
    alerts.push({
      title: `${input.newAdmissions} admission lead${input.newAdmissions === 1 ? "" : "s"} need follow-up`,
      description: "Contact inquiries before desired joining dates pass.",
      href: "/admin/leads",
    })
  }

  if (input.pendingInvites > 0) {
    alerts.push({
      title: `${input.pendingInvites} resident invite${input.pendingInvites === 1 ? "" : "s"} pending`,
      description: "Follow up with residents who have not activated access yet.",
      href: "/admin/residents",
    })
  }

  if (input.capacity > 0 && input.vacantBeds <= 2) {
    alerts.push({
      title: "Low vacancy",
      description: `${input.vacantBeds} student vacanc${input.vacantBeds === 1 ? "y" : "ies"} remain. Review reservations before confirming more joins.`,
      href: "/admin/vacancy",
    })
  }

  if (input.registeredResidents === 0 && input.roomsConfigured > 0) {
    alerts.push({
      title: "No residents registered yet",
      description: "Add a resident after admission approval or convert a confirmed reservation.",
      href: "/admin/residents/new",
    })
  }

  return alerts
}
