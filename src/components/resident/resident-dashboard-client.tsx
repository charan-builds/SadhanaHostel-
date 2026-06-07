"use client"

import type { Route } from "next"
import Link from "next/link"
import { useState } from "react"
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
  ReceiptText,
  User,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { LoadingState } from "@/components/shared/loading-state"
import { MotionReveal } from "@/components/shared/motion-reveal"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useAcknowledgeNotice,
  useCurrentResident,
  useInvoiceDownloadUrl,
  useMarkNoticeRead,
  useNotices,
  useNotifications,
  useResidentPaymentLedger,
} from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { buildFeeDueStatus, type FeeDueStatus } from "@/lib/finance/resident-due-status"
import { formatCurrency, formatDate } from "@/lib/format"

export { buildFeeDueStatus } from "@/lib/finance/resident-due-status"

export function ResidentDashboardClient() {
  const { organizationId, session } = useAuth()
  const [dismissedNoticeId, setDismissedNoticeId] = useState<string | null>(null)
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
  const notices = useNotices({
    organizationId: organizationId ?? "",
    hostelId,
    activeOnly: true,
    page: 1,
    pageSize: 20,
  })
  const unreadNotifications = useNotifications(
    organizationId
      ? {
          organizationId,
          hostelId,
          page: 1,
          pageSize: 1,
          channel: "in_app",
          unreadOnly: true,
        }
      : undefined
  )
  const downloadInvoice = useInvoiceDownloadUrl()
  const markNoticeRead = useMarkNoticeRead()
  const acknowledgeNotice = useAcknowledgeNotice()
  const unreadNotice =
    notices.data?.data.find(
      (notice) => notice.requires_acknowledgement && !notice.is_acknowledged
    ) ?? notices.data?.data.find((notice) => !notice.is_read)
  const noticePopupOpen = Boolean(unreadNotice && unreadNotice.id !== dismissedNoticeId)

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

  const latestPayment = ledger.data?.payments[0]
  const nextDueDate = ledger.data?.billing.nextDueDate
  const currentPeriod = ledger.data?.billing.currentPeriodMonth ?? currentPeriodMonth()
  const currentRecord =
    ledger.data?.feeRecords.find((record) => record.period_month === currentPeriod) ??
    ledger.data?.primaryDueRecord
  const dueRecord = ledger.data?.primaryDueRecord ?? currentRecord ?? null
  const amountDue = Math.max(
    dueRecord?.balance_amount ?? 0,
    ledger.data?.totals.currentDue ?? 0
  )
  const dueDate = dueRecord?.due_date ?? nextDueDate ?? null
  const invoiceId =
    ledger.data?.invoices.find(
      (invoice) => invoice.monthly_fee_record_id === dueRecord?.id
    )?.id ??
    latestPayment?.invoice_id ??
    null
  const feeStatus =
    dueDate && amountDue > 0
      ? buildFeeDueStatus({
          amountDue,
          dueDate,
        })
      : null
  const unreadNoticeCount =
    notices.data?.data.filter((notice) => !notice.is_read).length ?? 0
  const unreadNotificationCount = unreadNotifications.data?.meta.total ?? 0
  const residentName = resident.data.preferred_name || resident.data.full_name
  const roomLabel = formatRoomLabel({
    roomNumber: resident.data.current_room_number,
    roomName: resident.data.current_room_name,
    bedLabel: resident.data.current_bed_label,
  })

  async function openInvoice() {
    if (!organizationId || !invoiceId) {
      return
    }

    try {
      const result = await downloadInvoice.mutateAsync({
        organizationId,
        invoiceId,
        expiresInSeconds: 900,
      })
      window.open(result.signedUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to open invoice. Please retry."
      )
    }
  }

  async function resolvePopupNotice() {
    if (!organizationId || !unreadNotice) {
      return
    }

    if (unreadNotice.requires_acknowledgement && !unreadNotice.is_acknowledged) {
      await acknowledgeNotice.mutateAsync({
        noticeId: unreadNotice.id,
        input: { organizationId },
      })
    } else {
      await markNoticeRead.mutateAsync({
        noticeId: unreadNotice.id,
        input: { organizationId },
      })
    }

    setDismissedNoticeId(unreadNotice.id)
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-5 lg:max-w-5xl">
      <MotionReveal>
        <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{buildGreeting()}</p>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
                {residentName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{roomLabel}</p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <User className="size-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-5 rounded-2xl border bg-background/85 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">Current fee status</p>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${feeStatus?.className ?? "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
                {feeStatus?.label ?? "No dues"}
              </span>
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight">
              {formatCurrency(amountDue)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Due date: {dueDate ? formatDate(dueDate) : "Not scheduled"}
            </p>
          </div>
        </section>
      </MotionReveal>

      {feeStatus ? (
        <FeeDueStatusBanner
          status={feeStatus}
          invoiceId={invoiceId}
          isDownloading={downloadInvoice.isPending}
          onOpenInvoice={() => void openInvoice()}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <ResidentHomeCard
          href="/resident/payments"
          icon={CreditCard}
          title="Pay Fees"
          detail={amountDue > 0 ? formatCurrency(amountDue) : "Clear"}
        />
        <ResidentHomeCard
          href="/resident/notices"
          icon={FileText}
          title="Notices"
          detail="Notice center"
          badge={unreadNoticeCount}
        />
        <ResidentHomeCard
          icon={Bell}
          title="Notifications"
          detail="Finance, hostel, personal"
          badge={unreadNotificationCount}
          onClick={() => {
            window.dispatchEvent(new Event("open-resident-notifications"))
          }}
        />
        <ResidentHomeCard
          href="/resident/profile"
          icon={User}
          title="Profile"
          detail={resident.data.status}
        />
      </section>

      <Dialog
        open={noticePopupOpen}
        onOpenChange={(open) => {
          if (!open && unreadNotice) {
            setDismissedNoticeId(unreadNotice.id)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{unreadNotice?.title ?? "New notice"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {unreadNotice?.body}
            </p>
            <p className="text-xs text-muted-foreground">
              {unreadNotice?.published_at
                ? formatDate(unreadNotice.published_at)
                : "Published notice"}
            </p>
            {unreadNotice?.requires_acknowledgement ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">
                Acknowledgement required
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (unreadNotice) {
                  setDismissedNoticeId(unreadNotice.id)
                }
              }}
            >
              Later
            </Button>
            <Button
              type="button"
              disabled={markNoticeRead.isPending || acknowledgeNotice.isPending}
              onClick={() => void resolvePopupNotice()}
            >
              {markNoticeRead.isPending || acknowledgeNotice.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="size-4" aria-hidden="true" />
              )}
              {unreadNotice?.requires_acknowledgement ? "Acknowledge" : "Mark Read"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FeeDueStatusBanner({
  status,
  invoiceId,
  isDownloading,
  onOpenInvoice,
}: {
  status: FeeDueStatus
  invoiceId: string | null
  isDownloading: boolean
  onOpenInvoice: () => void
}) {
  return (
    <MotionReveal>
      <section className={`rounded-2xl border p-4 ${status.className}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/70">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{status.label}</p>
              <p className="mt-1 text-sm">
                {formatCurrency(status.amountDue)} due on {formatDate(status.dueDate)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button asChild className="h-11">
              <Link href={"/resident/payments" as Route}>
                <CreditCard className="size-4" aria-hidden="true" />
                Pay Now
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-white/70"
              disabled={!invoiceId || isDownloading}
              onClick={onOpenInvoice}
            >
              {isDownloading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ReceiptText className="size-4" aria-hidden="true" />
              )}
              View Invoice
            </Button>
          </div>
        </div>
      </section>
    </MotionReveal>
  )
}

function ResidentHomeCard({
  href,
  icon: Icon,
  title,
  detail,
  badge = 0,
  onClick,
}: {
  href?: Route
  icon: LucideIcon
  title: string
  detail: string
  badge?: number
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {badge > 0 ? (
          <span className="grid min-w-6 place-items-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </div>
      <div className="mt-4 min-w-0">
        <p className="truncate text-base font-semibold">{title}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{detail}</p>
      </div>
      <ChevronRight className="absolute bottom-4 right-4 size-4 text-muted-foreground" aria-hidden="true" />
    </>
  )
  const className =
    "relative min-h-32 rounded-2xl border bg-white/85 p-4 text-left shadow-soft transition active:scale-[0.99] hover:border-primary/30 hover:bg-white"

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  )
}

function currentPeriodMonth() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function buildGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return "Good morning"
  }

  if (hour < 17) {
    return "Good afternoon"
  }

  return "Good evening"
}

function formatRoomLabel(input: {
  roomNumber?: string | null
  roomName?: string | null
  bedLabel?: string | null
}) {
  if (!input.roomNumber) {
    return "Room pending"
  }

  const room = input.roomName
    ? `Room ${input.roomNumber}, ${input.roomName}`
    : `Room ${input.roomNumber}`

  return input.bedLabel ? `${room}, Bed ${input.bedLabel}` : room
}
