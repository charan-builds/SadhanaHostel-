"use client"

import Link from "next/link"
import type { Route } from "next"
import { useMemo, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRight,
  BedSingle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  HeartPulse,
  Home,
  MessageCircle,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { LoadingState } from "@/components/shared/loading-state"
import { MotionReveal } from "@/components/shared/motion-reveal"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useCurrentResident,
  useLeaves,
  useNotices,
  useResidentPaymentLedger,
  useSupportRequests,
} from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate, formatDateTime, humanizeEnum } from "@/lib/format"
import {
  buildResidentHomeExperience,
  type ResidentActionTone,
  type ResidentHomeExperience,
  type ResidentHomeRoute,
  type ResidentSmartAction,
  type ResidentTimelineEvent,
  type ResidentTimelineType,
} from "@/lib/resident-experience/home"

export function ResidentDashboardClient() {
  const { organizationId, session } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const hostelId = resident.data?.hostel_id ?? session?.hostelIds[0]
  const ledger = useResidentPaymentLedger(
    organizationId
      ? {
          organizationId,
          residentId: resident.data?.id,
        }
      : undefined
  )
  const leaves = useLeaves({
    organizationId: organizationId ?? "",
    hostelId,
    residentId: resident.data?.id,
    page: 1,
    pageSize: 8,
  })
  const notices = useNotices({
    organizationId: organizationId ?? "",
    hostelId,
    activeOnly: true,
    page: 1,
    pageSize: 8,
  })
  const supportRequests = useSupportRequests({
    organizationId: organizationId ?? "",
    residentId: resident.data?.id,
    page: 1,
    pageSize: 8,
  })
  const homeExperience = useMemo(() => {
    if (!resident.data) {
      return null
    }

    return buildResidentHomeExperience({
      resident: resident.data,
      ledger: ledger.data,
      notices: notices.data?.data ?? [],
      supportRequests: supportRequests.data?.data ?? [],
      leaves: leaves.data?.data ?? [],
    })
  }, [leaves.data?.data, ledger.data, notices.data?.data, resident.data, supportRequests.data?.data])

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization access pending"
        message="Ask an admin to complete your account assignment."
      />
    )
  }

  if (resident.isLoading) {
    return <LoadingState variant="cards" />
  }

  if (resident.error || !resident.data || !homeExperience) {
    return (
      <APIErrorState
        title="Profile not linked"
        message="Your login is not connected to a resident record yet."
        onRetry={() => void resident.refetch()}
      />
    )
  }

  const latestPayment = ledger.data?.payments[0]
  const latestLeave = leaves.data?.data[0]
  const latestNotice = notices.data?.data[0]
  const latestComplaint = supportRequests.data?.data[0]
  const isSecondaryDataLoading =
    ledger.isLoading || leaves.isLoading || notices.isLoading || supportRequests.isLoading
  const secondaryError =
    ledger.error ?? leaves.error ?? notices.error ?? supportRequests.error ?? null

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Resident Home`}
        description={`Welcome, ${resident.data.preferred_name || resident.data.full_name}. Your hostel day, money, notices, requests, and profile are in one place.`}
        actions={
          <Button asChild>
            <Link href={"/resident/payments" as Route}>
              <CreditCard className="size-4" aria-hidden="true" />
              Pay fee
            </Link>
          </Button>
        }
      />

      {secondaryError ? (
        <APIErrorState
          title="Some resident data could not be loaded"
          error={secondaryError}
          onRetry={() => {
            void ledger.refetch()
            void leaves.refetch()
            void notices.refetch()
            void supportRequests.refetch()
          }}
        />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SmartActionCenter
          actions={homeExperience.actions}
          isLoading={isSecondaryDataLoading}
        />
        <ResidentHealthCard experience={homeExperience} />
      </section>

      <QuickActions />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ResidentStatusTile
          icon={CreditCard}
          label="Payments"
          value={
            homeExperience.counts.currentDue > 0
              ? formatCurrency(homeExperience.counts.currentDue)
              : homeExperience.counts.pendingVerification > 0
                ? formatCurrency(homeExperience.counts.pendingVerification)
                : "Clear"
          }
          detail={
            homeExperience.counts.currentDue > 0
              ? "Due now"
              : homeExperience.counts.pendingVerification > 0
                ? "Pending verification"
                : latestPayment
                  ? `Last ${humanizeEnum(latestPayment.status)} on ${formatDate(latestPayment.created_at)}`
                  : "No dues found"
          }
          tone={homeExperience.counts.currentDue > 0 ? "warning" : "success"}
        />
        <ResidentStatusTile
          icon={Bell}
          label="Notices"
          value={homeExperience.counts.acknowledgementPending || homeExperience.counts.unreadNotices}
          detail={
            homeExperience.counts.acknowledgementPending > 0
              ? "Acknowledgement pending"
              : latestNotice
                ? latestNotice.title
                : "No active notices"
          }
          tone={
            homeExperience.counts.acknowledgementPending > 0
              ? "warning"
              : homeExperience.counts.unreadNotices > 0
                ? "info"
                : "success"
          }
        />
        <ResidentStatusTile
          icon={MessageCircle}
          label="Complaints"
          value={homeExperience.counts.openComplaints}
          detail={
            latestComplaint
              ? `${latestComplaint.subject} · ${humanizeEnum(latestComplaint.status)}`
              : "No open complaints"
          }
          tone={homeExperience.counts.openComplaints > 0 ? "info" : "success"}
        />
        <ResidentStatusTile
          icon={CalendarDays}
          label="Leave"
          value={homeExperience.counts.pendingLeaves}
          detail={
            latestLeave
              ? `${humanizeEnum(latestLeave.status)} · ${formatDate(latestLeave.from_date)}`
              : "No leave requests"
          }
          tone={homeExperience.counts.pendingLeaves > 0 ? "info" : "success"}
        />
        <ResidentStatusTile
          icon={User}
          label="Profile"
          value={`${homeExperience.health.profileCompletion}%`}
          detail={
            homeExperience.health.missingProfileFields.length > 0
              ? `${homeExperience.health.missingProfileFields.length} field${homeExperience.health.missingProfileFields.length === 1 ? "" : "s"} missing`
              : "Complete"
          }
          tone={homeExperience.health.profileCompletion === 100 ? "success" : "warning"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <ResidentRoomAndProfile
          residentName={resident.data.full_name}
          admissionNumber={resident.data.admission_number}
          status={resident.data.status}
          roomNumber={resident.data.current_room_number}
          roomName={resident.data.current_room_name}
          bedLabel={resident.data.current_bed_label}
          monthlyFeeAmount={resident.data.monthly_fee_amount}
          joinedOn={resident.data.joined_on}
        />
        <ResidentTimeline events={homeExperience.timeline} />
      </section>
    </div>
  )
}

function SmartActionCenter({
  actions,
  isLoading,
}: {
  actions: ResidentSmartAction[]
  isLoading: boolean
}) {
  return (
    <MotionReveal>
      <section className="rounded-xl border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Smart Action Center</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Today needs attention</h2>
          </div>
          <Badge variant={actions.length > 0 ? "secondary" : "default"}>
            {actions.length > 0 ? `${actions.length} active` : "All clear"}
          </Badge>
        </div>

        {isLoading ? (
          <div className="mt-5 grid gap-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 rounded-lg bg-muted/70" />
            ))}
          </div>
        ) : actions.length === 0 ? (
          <div className="mt-5 rounded-lg border border-success/25 bg-success-surface p-4">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-success-foreground">Nothing urgent right now</p>
                <p className="mt-1 text-sm leading-6 text-success-foreground/80">
                  Your payments, notices, complaints, leave, and profile are up to date.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {actions.slice(0, 5).map((action) => (
              <ResidentSmartActionCard key={action.id} action={action} />
            ))}
          </div>
        )}
      </section>
    </MotionReveal>
  )
}

function ResidentSmartActionCard({ action }: { action: ResidentSmartAction }) {
  const Icon = actionToneIcon[action.tone]

  return (
    <article className={`rounded-lg border p-4 ${actionToneClassName[action.tone]}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/75 ring-1 ring-white/70">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{action.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 opacity-85">
              {action.description}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 bg-background/80">
          <Link href={action.href as Route}>
            {action.cta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  )
}

function ResidentHealthCard({ experience }: { experience: ResidentHomeExperience }) {
  const health = experience.health

  return (
    <MotionReveal>
      <section className="rounded-xl border bg-background p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Resident Health Score</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{health.label}</h2>
          </div>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <HeartPulse className="size-5" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className="grid size-28 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(#16a34a ${health.score}%, #e5e7eb 0)`,
            }}
            aria-label={`Resident health score ${health.score} percent`}
          >
            <div className="grid size-20 place-items-center rounded-full bg-background">
              <span className="text-2xl font-semibold">{health.score}</span>
            </div>
          </div>
          <div className="grid flex-1 gap-3">
            <HealthBar label="Profile" value={health.profileCompletion} />
            <HealthBar label="Payments" value={health.paymentScore} />
            <HealthBar label="Actions" value={health.actionScore} />
          </div>
        </div>

        {health.missingProfileFields.length > 0 ? (
          <div className="mt-5 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Missing: {health.missingProfileFields.join(", ")}
          </div>
        ) : null}
      </section>
    </MotionReveal>
  )
}

function QuickActions() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <QuickAction
        icon={CreditCard}
        href="/resident/payments"
        title="Pay fee"
        description="Open ledger, pay by UPI, and upload proof."
      />
      <QuickAction
        icon={MessageCircle}
        href="/resident/support"
        title="Raise complaint"
        description="Track maintenance, safety, payment, or account issues."
      />
      <QuickAction
        icon={CalendarDays}
        href="/resident/leave"
        title="Request leave"
        description="Submit travel dates and follow approval."
      />
      <QuickAction
        icon={BedSingle}
        href="/resident/profile"
        title="View room details"
        description="Check room, bed, profile, and fee information."
      />
    </section>
  )
}

function QuickAction({
  icon: Icon,
  href,
  title,
  description,
}: {
  icon: LucideIcon
  href: ResidentHomeRoute
  title: string
  description: string
}) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start p-4 text-left">
      <Link href={href as Route}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{title}</span>
          <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
      </Link>
    </Button>
  )
}

function ResidentStatusTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  detail: string
  tone: ResidentActionTone
}) {
  return (
    <MotionReveal>
      <article className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={`flex size-9 items-center justify-center rounded-lg ring-1 ${tileToneClassName[tone]}`}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-3 truncate text-2xl font-semibold">{value}</p>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {detail}
        </p>
      </article>
    </MotionReveal>
  )
}

function ResidentRoomAndProfile({
  residentName,
  admissionNumber,
  status,
  roomNumber,
  roomName,
  bedLabel,
  monthlyFeeAmount,
  joinedOn,
}: {
  residentName: string
  admissionNumber: string
  status: string
  roomNumber?: string | null
  roomName?: string | null
  bedLabel?: string | null
  monthlyFeeAmount: number
  joinedOn?: string | null
}) {
  return (
    <MotionReveal>
      <section className="rounded-xl border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Profile and room</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{residentName}</h2>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={ClipboardList} label="Admission" value={admissionNumber} />
          <InfoRow
            icon={Home}
            label="Room"
            value={
              roomNumber
                ? `${roomNumber}${roomName ? ` · ${roomName}` : ""}`
                : "Not assigned"
            }
          />
          <InfoRow icon={BedSingle} label="Bed" value={bedLabel ?? "Not assigned"} />
          <InfoRow
            icon={CreditCard}
            label="Monthly fee"
            value={formatCurrency(monthlyFeeAmount)}
          />
          <InfoRow
            icon={CalendarDays}
            label="Joined"
            value={joinedOn ? formatDate(joinedOn) : "Pending"}
          />
        </div>

        <Button asChild variant="outline" className="mt-5">
          <Link href={"/resident/profile" as Route}>
            Open profile
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </MotionReveal>
  )
}

function ResidentTimeline({ events }: { events: ResidentTimelineEvent[] }) {
  return (
    <MotionReveal>
      <section className="rounded-xl border bg-background p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Resident Timeline</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Recent activity</h2>
          </div>
          <Badge variant="secondary">{events.length} events</Badge>
        </div>

        {events.length === 0 ? (
          <EmptyState
            title="No activity yet"
            message="Payments, notices, complaints, leave updates, and room changes will appear here."
          />
        ) : (
          <div className="mt-5 grid gap-3">
            {events.map((event) => (
              <TimelineItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </MotionReveal>
  )
}

function TimelineItem({ event }: { event: ResidentTimelineEvent }) {
  const Icon = timelineIcon[event.type]

  return (
    <Link
      href={event.href as Route}
      className="group grid gap-3 rounded-lg border bg-background/70 p-3 transition hover:border-primary/30 hover:bg-primary/5 sm:grid-cols-[auto_1fr_auto]"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{event.title}</span>
          {event.status ? <StatusBadge status={event.status} /> : null}
        </span>
        <span className="mt-1 block line-clamp-2 text-sm leading-5 text-muted-foreground">
          {formatTimelineDescription(event)}
        </span>
      </span>
      <span className="text-sm text-muted-foreground sm:text-right">
        {formatDateTime(event.at)}
      </span>
    </Link>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  )
}

function HealthBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}

function formatTimelineDescription(event: ResidentTimelineEvent) {
  if (event.type === "payment") {
    return event.description.replace(/for (\d+(?:\.\d+)?)/, (_, amount: string) =>
      `for ${formatCurrency(Number(amount))}`
    )
  }

  return event.description
}

const actionToneIcon: Record<ResidentActionTone, LucideIcon> = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: FileText,
  success: CheckCircle2,
}

const actionToneClassName: Record<ResidentActionTone, string> = {
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
  warning: "border-warning/30 bg-warning-surface text-warning-foreground",
  info: "border-info/30 bg-info-surface text-info-foreground",
  success: "border-success/30 bg-success-surface text-success-foreground",
}

const tileToneClassName: Record<ResidentActionTone, string> = {
  danger: "bg-destructive/10 text-destructive ring-destructive/15",
  warning: "bg-warning-surface text-warning-foreground ring-warning/20",
  info: "bg-info-surface text-info-foreground ring-info/20",
  success: "bg-success-surface text-success-foreground ring-success/20",
}

const timelineIcon: Record<ResidentTimelineType, LucideIcon> = {
  notice: Bell,
  payment: CreditCard,
  support: Wrench,
  leave: CalendarDays,
  room: BedSingle,
}
