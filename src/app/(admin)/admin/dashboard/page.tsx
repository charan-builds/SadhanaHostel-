import Link from "next/link"
import type { Route } from "next"
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  GalleryHorizontalEnd,
  Globe,
  IndianRupee,
  Plus,
  ReceiptText,
  Users,
} from "lucide-react"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingState } from "@/components/shared/loading-state"
import { MetricCard } from "@/components/shared/metric-card"
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
import {
  mockResidents,
  mockRooms,
  pendingFeeResidents,
  pendingLeaves,
  recentPayments,
} from "@/data/admin"
import { cn } from "@/lib/utils"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date?: string) {
  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

const totalResidents = mockResidents.length
const activeResidents = mockResidents.filter((resident) => resident.status === "active").length
const monthlyCollected = recentPayments
  .filter((payment) => payment.status === "paid")
  .reduce((total, payment) => total + payment.amount, 0)
const pendingFees = recentPayments
  .filter((payment) => payment.status !== "paid")
  .reduce((total, payment) => total + payment.amount, 0)
const totalRooms = mockRooms.length
const occupiedBeds = mockRooms.reduce((total, room) => total + room.occupied, 0)
const totalBeds = mockRooms.reduce((total, room) => total + room.capacity, 0)
const availableBeds = totalBeds - occupiedBeds
const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0
const collectionPercent =
  monthlyCollected + pendingFees > 0
    ? Math.round((monthlyCollected / (monthlyCollected + pendingFees)) * 100)
    : 0

const pendingPaymentsByResident = new Map(
  recentPayments
    .filter((payment) => payment.status !== "paid")
    .map((payment) => [payment.residentName, payment]),
)

const quickActions = [
  {
    title: "Add Resident",
    description: "Open resident onboarding",
    href: "/admin/residents",
    icon: Plus,
  },
  {
    title: "Record Payment",
    description: "Review fee collection",
    href: "/admin/payments",
    icon: ReceiptText,
  },
  {
    title: "Review Leaves",
    description: "Handle pending requests",
    href: "/admin/leaves",
    icon: CalendarDays,
  },
  {
    title: "Update Website",
    description: "Manage CMS content",
    href: "/admin/website",
    icon: Globe,
  },
  {
    title: "Upload Gallery Image",
    description: "Prepare gallery assets",
    href: "/admin/gallery",
    icon: GalleryHorizontalEnd,
  },
] as const

const isDashboardLoading = false

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-slate-100", className)}>
      <div className="h-full rounded-full bg-blue-600" style={{ width: `${value}%` }} />
    </div>
  )
}

export default function AdminDashboardPage() {
  if (isDashboardLoading) {
    return (
      <ResponsiveContainer size="wide" className="px-0 sm:px-0">
        <LoadingState variant="dashboard" />
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Admin Dashboard"
        description="Monitor residents, payments, rooms, leaves, and hostel operations."
        actions={
          <>
            <Button asChild>
              <Link href={"/admin/residents" as Route}>
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
          value={totalResidents}
          description="All mock residents"
          icon={Users}
          tone="info"
        />
        <StatCard
          title="Active Residents"
          value={activeResidents}
          description="Currently staying"
          icon={Users}
          tone="success"
        />
        <StatCard
          title="Monthly Fee Collected"
          value={formatCurrency(monthlyCollected)}
          description={`${collectionPercent}% collected`}
          icon={IndianRupee}
          tone="success"
        />
        <StatCard
          title="Pending Fees"
          value={formatCurrency(pendingFees)}
          description={`${pendingFeeResidents.length} resident pending`}
          icon={CreditCard}
          tone="warning"
        />
        <StatCard
          title="Pending Leaves"
          value={pendingLeaves.length}
          description="Awaiting review"
          icon={CalendarDays}
          tone="warning"
        />
        <StatCard
          title="Room Occupancy"
          value={`${occupancyPercent}%`}
          description={`${occupiedBeds}/${totalBeds} beds occupied`}
          icon={Building2}
          tone="info"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <MetricCard
          title="Monthly Revenue Overview"
          value={formatCurrency(monthlyCollected)}
          subtitle={`${formatCurrency(pendingFees)} pending this month`}
          icon={IndianRupee}
          footer={
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Collection progress</span>
              <span className="font-medium text-foreground">{collectionPercent}%</span>
            </div>
          }
        >
          <ProgressBar value={collectionPercent} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs font-medium text-muted-foreground">Collected</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatCurrency(monthlyCollected)}
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs font-medium text-muted-foreground">Pending</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatCurrency(pendingFees)}
              </p>
            </div>
          </div>
          <div className="mt-5 flex h-36 items-end gap-2 rounded-xl border bg-slate-50 p-4">
            {[38, 56, 44, 72, 60, collectionPercent].map((height, index) => (
              <div key={index} className="flex flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-blue-600/80"
                  style={{ height: `${Math.max(height, 12)}%` }}
                />
              </div>
            ))}
          </div>
        </MetricCard>

        <MetricCard
          title="Occupancy Overview"
          value={`${occupancyPercent}%`}
          subtitle={`${availableBeds} beds available across ${totalRooms} rooms`}
          icon={Building2}
          footer={
            <div className="text-sm text-muted-foreground">
              {occupiedBeds} occupied / {totalBeds} total beds
            </div>
          }
        >
          <ProgressBar value={occupancyPercent} className="mt-1" />
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-slate-50 p-3 text-center">
              <p className="text-xl font-semibold">{totalRooms}</p>
              <p className="mt-1 text-xs text-muted-foreground">Rooms</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3 text-center">
              <p className="text-xl font-semibold">{occupiedBeds}</p>
              <p className="mt-1 text-xs text-muted-foreground">Occupied</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3 text-center">
              <p className="text-xl font-semibold">{availableBeds}</p>
              <p className="mt-1 text-xs text-muted-foreground">Available</p>
            </div>
          </div>
        </MetricCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataTableShell
          title="Recent Payments"
          description="Latest fee collection activity from mock data."
          empty={
            recentPayments.length === 0 ? (
              <EmptyState title="No payments yet" description="Recent payments will appear here." />
            ) : undefined
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.residentName}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell className="capitalize">{payment.mode.replace("-", " ")}</TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell>{formatDate(payment.paidOn ?? payment.dueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableShell>

        <DataTableShell
          title="Pending Leave Requests"
          description="Resident leave requests waiting for action."
          empty={
            pendingLeaves.length === 0 ? (
              <EmptyState title="No pending leaves" description="Leave requests will appear here." />
            ) : undefined
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>From Date</TableHead>
                <TableHead>Return Date</TableHead>
                <TableHead>Travel Mode</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingLeaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell className="font-medium">{leave.residentName}</TableCell>
                  <TableCell>{formatDate(leave.fromDate)}</TableCell>
                  <TableCell>{formatDate(leave.toDate)}</TableCell>
                  <TableCell>{leave.travelMode ?? "Not specified"}</TableCell>
                  <TableCell>
                    <StatusBadge status={leave.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableShell>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <DataTableShell
          title="Pending Fee Residents"
          description="Residents with unpaid or pending monthly fees."
          empty={
            pendingFeeResidents.length === 0 ? (
              <EmptyState
                title="No pending fees"
                description="Residents with pending fees will appear here."
              />
            ) : undefined
          }
        >
          <div className="divide-y">
            {pendingFeeResidents.map((resident) => {
              const pendingPayment = pendingPaymentsByResident.get(resident.name)

              return (
                <div
                  key={resident.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{resident.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Room {resident.roomNumber} • {pendingPayment?.month ?? "Current month"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{formatCurrency(resident.feeAmount)}</p>
                    <StatusBadge status={resident.paymentStatus} />
                  </div>
                </div>
              )
            })}
          </div>
        </DataTableShell>

        <DataTableShell title="Quick Actions" description="Common admin actions for daily work.">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon

              return (
                <Link
                  key={action.title}
                  href={action.href as Route}
                  className="group rounded-xl border bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <ArrowUpRight
                      className="size-4 text-muted-foreground transition-colors group-hover:text-blue-700"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{action.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {action.description}
                  </p>
                </Link>
              )
            })}
          </div>
        </DataTableShell>
      </section>

    </ResponsiveContainer>
  )
}
