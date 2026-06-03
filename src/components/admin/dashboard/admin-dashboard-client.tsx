"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  FileCheck2,
  IndianRupee,
  KeyRound,
  Plus,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react"
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  type Variants,
} from "framer-motion"

import { APIErrorState, EmptyState } from "@/components/system"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"
import { useDashboardAnalytics, useLeaves, usePayments, useResidents } from "@/hooks"

const dashboardStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}

const dashboardItem: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

type Tone = "success" | "warning" | "info" | "danger" | "neutral"

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
    return <PremiumDashboardSkeleton />
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
  const totalResidents = metrics?.totalResidents ?? residents.data?.meta.total ?? 0
  const monthlyRevenue = metrics?.finance.monthlyRevenue ?? 0
  const pendingDues = metrics?.finance.pendingDues ?? 0
  const pendingPayments = metrics?.finance.pendingPayments ?? 0
  const activeResidents = lifecycle?.activeResidents ?? 0
  const onboardingResidents = lifecycle?.onboardingResidents ?? 0
  const pendingVerification = metrics?.operations.pendingVerification ?? 0
  const activeLeaves = metrics?.operations.activeLeaves ?? 0
  const newAdmissions = metrics?.operations.newAdmissions ?? 0
  const pendingInvites = metrics?.operations.pendingInvites ?? 0

  const operationalAlerts = buildOperationalAlerts({
    registeredResidents: totalResidents,
    onboardingResidents,
    pendingVerification,
    pendingPayments,
    newAdmissions,
    pendingInvites,
  })

  const kpis = [
    {
      title: "Registered Residents",
      value: totalResidents,
      detail: "All non-deleted resident records",
      icon: Users,
      tone: "info" as Tone,
      href: "/admin/residents",
    },
    {
      title: "Active Residents",
      value: activeResidents,
      detail: "Verified residents in active lifecycle",
      icon: UserCheck,
      tone: "success" as Tone,
      href: "/admin/residents",
    },
    {
      title: "Monthly Revenue",
      value: monthlyRevenue,
      detail: "Verified collections this month",
      icon: IndianRupee,
      tone: "success" as Tone,
      href: "/admin/payments",
      currency: true,
    },
    {
      title: "Pending Dues",
      value: pendingDues,
      detail: "Outstanding balances",
      icon: CreditCard,
      tone: "warning" as Tone,
      href: "/admin/payments",
      currency: true,
    },
  ]

  const healthCards = [
    {
      title: "Onboarding Follow-up",
      value: pendingVerification,
      detail: "Older or rejected profiles need staff action",
      icon: FileCheck2,
      tone: pendingVerification ? "warning" : "success",
      href: "/admin/residents/verification",
    },
    {
      title: "Draft / Onboarding",
      value: onboardingResidents,
      detail: "Need invite, profile, or document action",
      icon: UserRoundPlus,
      tone: onboardingResidents ? "warning" : "success",
      href: "/admin/residents",
    },
    {
      title: "Active Leaves",
      value: activeLeaves,
      detail: "Approved residents currently away",
      icon: CalendarDays,
      tone: activeLeaves ? "info" : "success",
      href: "/admin/leaves",
    },
    {
      title: "Pending Invites",
      value: pendingInvites,
      detail: "Residents not activated yet",
      icon: KeyRound,
      tone: pendingInvites ? "warning" : "success",
      href: "/admin/residents",
    },
  ] satisfies Array<{
    title: string
    value: number
    detail: string
    icon: LucideIcon
    tone: Tone
    href: string
  }>

  const timeline = buildActivityTimeline({
    payments: payments.data?.data ?? [],
    leaves: leaves.data?.data ?? [],
  })

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Admin Dashboard"
        description="Operational overview for residents, onboarding, payments, leaves, notices, and support work."
        badge="Live workspace"
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

      <motion.div variants={dashboardStagger} initial="hidden" animate="show" className="grid gap-6">
        <motion.section
          variants={dashboardItem}
          className="relative overflow-hidden rounded-xl border border-white/70 bg-sidebar p-5 text-sidebar-foreground shadow-lifted"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,oklch(0.67_0.16_188/0.28),transparent_32rem),radial-gradient(circle_at_90%_10%,oklch(0.51_0.18_252/0.2),transparent_24rem)]" />
          <div className="relative grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="border-white/15 bg-white/10 text-sidebar-foreground">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Premium operations cockpit
                </Badge>
                <Badge variant="secondary" className="border-white/15 bg-white/10 text-sidebar-foreground">
                  Generated {metrics?.generatedAt ? formatDate(metrics.generatedAt) : "now"}
                </Badge>
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
                Hostel health at a glance.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-sidebar-foreground/68">
                Track residents, collections, onboarding work, payments, and support pressure
                from one command surface.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <HeroSignal label="Residents" value={totalResidents} icon={Users} />
              <HeroSignal label="Payment Queue" value={pendingPayments} icon={CreditCard} />
              <HeroSignal label="Alerts" value={operationalAlerts.length} icon={AlertTriangle} />
            </div>
          </div>
        </motion.section>

        <motion.section variants={dashboardStagger} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <AnimatedKpiCard key={kpi.title} {...kpi} />
          ))}
        </motion.section>

        <section className="grid gap-6">
          <motion.div variants={dashboardItem}>
            <RevenuePanel
              monthlyRevenue={monthlyRevenue}
              pendingDues={pendingDues}
              pendingPayments={pendingPayments}
            />
          </motion.div>
        </section>

        <motion.section variants={dashboardStagger} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {healthCards.map((card) => (
            <HealthCard key={card.title} {...card} />
          ))}
        </motion.section>

        {operationalAlerts.length > 0 ? (
          <motion.section variants={dashboardItem}>
            <Card className="border-warning/25 bg-warning-surface/80">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-warning-foreground" aria-hidden="true" />
                  <CardTitle className="text-warning-foreground">Operational Attention</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {operationalAlerts.map((alert) => (
                    <Link
                      key={alert.title}
                      href={alert.href as Route}
                      className="group rounded-xl border border-warning/20 bg-white/55 p-3 text-sm transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-warning-foreground">{alert.title}</p>
                          <p className="mt-1 leading-5 text-warning-foreground/75">
                            {alert.description}
                          </p>
                        </div>
                        <ArrowUpRight className="size-4 shrink-0 opacity-50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <motion.div variants={dashboardItem}>
            <RecentPaymentsTable payments={payments} />
          </motion.div>
          <motion.div variants={dashboardItem}>
            <ActivityTimeline timeline={timeline} isLoading={payments.isLoading || leaves.isLoading} />
          </motion.div>
        </section>

        <motion.section variants={dashboardItem}>
          <RecentLeavesTable leaves={leaves} />
        </motion.section>
      </motion.div>
    </ResponsiveContainer>
  )
}

function AnimatedNumber({
  value,
  currency = false,
}: {
  value: number
  currency?: boolean
}) {
  const source = useMotionValue(0)
  const spring = useSpring(source, { damping: 24, stiffness: 120 })
  const [display, setDisplay] = useState(() => (currency ? formatCurrency(0) : "0"))

  useEffect(() => {
    source.set(value)
  }, [source, value])

  useMotionValueEvent(spring, "change", (latest) => {
    const rounded = Math.round(latest)
    setDisplay(currency ? formatCurrency(rounded) : String(rounded))
  })

  return <>{display}</>
}

function AnimatedKpiCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
  href,
  currency = false,
}: {
  title: string
  value: number
  detail: string
  icon: LucideIcon
  tone: Tone
  href: string
  currency?: boolean
}) {
  return (
    <motion.article variants={dashboardItem}>
      <Link
        href={href as Route}
        className="group block h-full rounded-xl border border-white/70 bg-card/90 p-4 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              <AnimatedNumber value={value} currency={currency} />
            </p>
          </div>
          <span className={cn("flex size-11 items-center justify-center rounded-xl ring-1", toneClasses[tone])}>
            <Icon className="size-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm leading-5 text-muted-foreground">{detail}</p>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </Link>
    </motion.article>
  )
}

function RevenuePanel({
  monthlyRevenue,
  pendingDues,
  pendingPayments,
}: {
  monthlyRevenue: number
  pendingDues: number
  pendingPayments: number
}) {
  const values = [
    { label: "Collected", value: monthlyRevenue, tone: "bg-success" },
    { label: "Pending dues", value: pendingDues, tone: "bg-warning" },
    { label: "Review queue", value: pendingPayments, tone: "bg-info" },
  ]
  const maxValue = Math.max(...values.map((item) => item.value), 1)

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Revenue Snapshot</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Current month collections, outstanding dues, and finance queue.
            </p>
          </div>
          <CircleDollarSign className="size-5 text-success" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {values.map((item, index) => {
            const width = Math.max((item.value / maxValue) * 100, item.value > 0 ? 8 : 2)

            return (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.label === "Review queue" ? item.value : formatCurrency(item.value)}
                  </span>
                </div>
                <div className="h-10 overflow-hidden rounded-xl bg-muted">
                  <motion.div
                    className={cn("flex h-full items-center justify-end rounded-xl px-3 text-xs font-semibold text-white shadow-sm", item.tone)}
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.75, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {Math.round(width)}%
                  </motion.div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-white/55 p-3">
            <p className="text-xs text-muted-foreground">Verified collections</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(monthlyRevenue)}</p>
          </div>
          <div className="rounded-xl border bg-white/55 p-3">
            <p className="text-xs text-muted-foreground">UPI proofs pending</p>
            <p className="mt-1 text-xl font-semibold">{pendingPayments}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function HealthCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
  href,
}: {
  title: string
  value: number
  detail: string
  icon: LucideIcon
  tone: Tone
  href: string
}) {
  return (
    <motion.article variants={dashboardItem}>
      <Link href={href as Route} className="group block h-full rounded-xl border bg-card/90 p-4 shadow-soft backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-lifted">
        <div className="flex items-start justify-between gap-3">
          <span className={cn("flex size-10 items-center justify-center rounded-xl ring-1", toneClasses[tone])}>
            <Icon className="size-5 transition-transform group-hover:scale-110" />
          </span>
          <Badge variant="secondary">{value}</Badge>
        </div>
        <h3 className="mt-4 text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
      </Link>
    </motion.article>
  )
}

function RecentPaymentsTable({ payments }: { payments: ReturnType<typeof usePayments> }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Recent Payments</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest payment records from the production API.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={"/admin/payments" as Route}>Open finance</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {payments.isLoading ? (
          <LoadingState variant="table" />
        ) : payments.data?.data.length === 0 ? (
          <EmptyState
            title="No payments yet"
            message="Payments will appear here after residents submit or admins record them."
          />
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
      </CardContent>
    </Card>
  )
}

function RecentLeavesTable({ leaves }: { leaves: ReturnType<typeof useLeaves> }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Recent Leave Requests</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Latest resident leave activity.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={"/admin/leaves" as Route}>Review leaves</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {leaves.isLoading ? (
          <LoadingState variant="table" />
        ) : leaves.data?.data.length === 0 ? (
          <EmptyState title="No leave requests" message="Resident leave requests will appear here." />
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
      </CardContent>
    </Card>
  )
}

function ActivityTimeline({
  timeline,
  isLoading,
}: {
  timeline: Array<{ id: string; title: string; detail: string; date: string; status: string; type: string }>
  isLoading: boolean
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Recent Activity Timeline</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Payments and leave activity in chronological order.
            </p>
          </div>
          <TrendingUp className="size-5 text-primary" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState variant="cards" rows={3} />
        ) : timeline.length === 0 ? (
          <EmptyState title="No recent activity" message="Resident activity will appear here." />
        ) : (
          <div className="relative grid gap-4 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
            {timeline.map((item, index) => (
              <motion.div
                key={`${item.type}-${item.id}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                className="relative grid grid-cols-[2rem_1fr] gap-3"
              >
                <span className="relative z-10 flex size-8 items-center justify-center rounded-full border bg-background text-primary shadow-sm">
                  {item.type === "payment" ? (
                    <IndianRupee className="size-4" aria-hidden="true" />
                  ) : (
                    <CalendarDays className="size-4" aria-hidden="true" />
                  )}
                </span>
                <div className="rounded-xl border bg-white/55 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.date)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HeroSignal({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: LucideIcon
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur">
      <Icon className="size-4 text-sidebar-primary" aria-hidden="true" />
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-sidebar-foreground/60">{label}</p>
    </div>
  )
}

function PremiumDashboardSkeleton() {
  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <div className="grid gap-4">
        <LoadingState variant="cards" rows={1} />
        <LoadingState variant="dashboard" />
      </div>
    </ResponsiveContainer>
  )
}

function buildActivityTimeline({
  payments,
  leaves,
}: {
  payments: Array<{
    id: string
    amount: number
    method: string
    status: string
    paid_at: string | null
    created_at: string
  }>
  leaves: Array<{
    id: string
    resident_id: string
    from_date: string
    to_date: string
    status: string
  }>
}) {
  return [
    ...payments.map((payment) => ({
      id: payment.id,
      title: `Payment ${payment.id.slice(0, 8)}`,
      detail: `${formatCurrency(payment.amount)} via ${payment.method.replace("_", " ")}`,
      date: payment.paid_at ?? payment.created_at,
      status: payment.status,
      type: "payment",
    })),
    ...leaves.map((leave) => ({
      id: leave.id,
      title: `Leave ${leave.resident_id.slice(0, 8)}`,
      detail: `${formatDate(leave.from_date)} to ${formatDate(leave.to_date)}`,
      date: leave.from_date,
      status: leave.status,
      type: "leave",
    })),
  ]
    .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
    .slice(0, 6)
}

function buildOperationalAlerts(input: {
  registeredResidents: number
  onboardingResidents: number
  pendingVerification: number
  pendingPayments: number
  newAdmissions: number
  pendingInvites: number
}) {
  const alerts: Array<{ title: string; description: string; href: string }> = []

  if (input.onboardingResidents > 0) {
    alerts.push({
      title: `${input.onboardingResidents} resident${input.onboardingResidents === 1 ? "" : "s"} in onboarding`,
      description: "Draft or invited residents are registered but do not count as occupied students yet.",
      href: "/admin/residents",
    })
  }

  if (input.pendingVerification > 0) {
    alerts.push({
      title: `${input.pendingVerification} onboarding follow-up${input.pendingVerification === 1 ? "" : "s"} pending`,
      description: "Check older profiles that were already waiting before automatic completion was enabled.",
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

  if (input.registeredResidents === 0) {
    alerts.push({
      title: "No residents registered yet",
      description: "Add the first resident after admission approval.",
      href: "/admin/residents/new",
    })
  }

  return alerts
}

const toneClasses = {
  success: "border-success/20 bg-success-surface text-success-foreground",
  warning: "border-warning/25 bg-warning-surface text-warning-foreground",
  info: "border-info/20 bg-info-surface text-info-foreground",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted text-muted-foreground",
} as const

const tonePills = {
  success: "bg-success-surface text-success-foreground",
  warning: "bg-warning-surface text-warning-foreground",
  info: "bg-info-surface text-info-foreground",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const
