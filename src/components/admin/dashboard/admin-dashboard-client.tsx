"use client"

import Link from "next/link"
import type { Route } from "next"
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  IndianRupee,
  Plus,
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
import { useDashboardAnalytics, useLeaves, usePayments, useResidents, useRooms } from "@/hooks"

export function AdminDashboardClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
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
        title="Organization access required"
        message="Your admin account is not assigned to an organization yet."
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

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Admin Dashboard"
        description="Live overview of residents, occupancy, collections, pending dues, and leave activity."
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="Total Residents"
          value={metrics?.totalResidents ?? residents.data?.meta.total ?? 0}
          description="Residents in this tenant"
          icon={Users}
          tone="info"
        />
        <StatCard
          title="Rooms"
          value={rooms.data?.meta.total ?? 0}
          description="Configured room inventory"
          icon={Building2}
          tone="info"
        />
        <StatCard
          title="Occupancy"
          value={`${Math.round(metrics?.occupancy.occupancyRate ?? 0)}%`}
          description={`${metrics?.occupancy.occupiedBeds ?? 0}/${metrics?.occupancy.capacity ?? 0} beds occupied`}
          icon={Building2}
          tone="success"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(metrics?.finance.monthlyRevenue ?? 0)}
          description="Verified collection"
          icon={IndianRupee}
          tone="success"
        />
        <StatCard
          title="Pending Dues"
          value={formatCurrency(metrics?.finance.pendingDues ?? 0)}
          description="Outstanding balances"
          icon={CreditCard}
          tone="warning"
        />
        <StatCard
          title="Recent Leaves"
          value={leaves.data?.meta.total ?? 0}
          description="Leave records visible to admin"
          icon={CalendarDays}
          tone="warning"
        />
      </section>

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
