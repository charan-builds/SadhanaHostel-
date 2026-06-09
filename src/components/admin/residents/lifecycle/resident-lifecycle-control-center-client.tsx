"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  RefreshCw,
  Search,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useResidentLifecycleControlCenter } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  ResidentLifecycleCard,
  ResidentLifecycleStageKey,
  ResidentLifecycleTone,
} from "@/types/resident-lifecycle"

const quickFilters: Array<{
  key: "all" | ResidentLifecycleStageKey | "health_low"
  label: string
}> = [
  { key: "all", label: "All" },
  { key: "fee_due", label: "Fee Due" },
  { key: "advance_covered", label: "Advance Covered" },
  { key: "profile_incomplete", label: "Profile Incomplete" },
  { key: "leave_pending", label: "Leave Pending" },
  { key: "checkout_pending", label: "Checkout Pending" },
  { key: "health_low", label: "Low Health" },
]

export function ResidentLifecycleControlCenterClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [search, setSearch] = useState("")
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [roomFilter, setRoomFilter] = useState("all")
  const [quickFilter, setQuickFilter] =
    useState<(typeof quickFilters)[number]["key"]>("all")
  const center = useResidentLifecycleControlCenter({
    organizationId: organizationId ?? "",
    hostelId,
    search,
    month,
  })
  const data = center.data
  const roomOptions = useMemo(() => {
    const rooms = new Map<string, string>()

    for (const card of data?.allCards ?? []) {
      if (card.roomId) {
        rooms.set(card.roomId, card.roomLabel ?? card.roomId.slice(0, 8))
      }
    }

    return Array.from(rooms.entries())
  }, [data])
  const columns = useMemo(() => {
    if (!data) {
      return []
    }

    return data.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => {
        if (roomFilter !== "all" && card.roomId !== roomFilter) {
          return false
        }

        if (quickFilter === "all") {
          return true
        }

        if (quickFilter === "health_low") {
          return card.healthScore < 60
        }

        return card.stages.includes(quickFilter)
      }),
    }))
  }, [data, quickFilter, roomFilter])

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Resident lifecycle controls will load when organization access is ready."
      />
    )
  }

  if (center.isLoading) {
    return <LoadingState variant="dashboard" />
  }

  if (center.isError) {
    return (
      <APIErrorState
        title="Lifecycle control center failed to load"
        error={center.error}
        onRetry={() => void center.refetch()}
      />
    )
  }

  if (!data) {
    return (
      <EmptyState
        title="No lifecycle data"
        message="Add residents to start tracking lifecycle state."
      />
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Resident Lifecycle Control Center"
        description="Drafts, invites, verification, active operations, dues, advance coverage, leave, and checkout state in one Kanban surface."
        badge={`Health ${data.health.averageScore}/100`}
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={center.isFetching}
            onClick={() => void center.refetch()}
          >
            <RefreshCw
              className={cn("size-4", center.isFetching && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Healthy" value={data.health.healthy} icon={CheckCircle2} tone="green" />
        <Metric label="Attention" value={data.health.attention} icon={CircleAlert} tone="yellow" />
        <Metric label="Critical" value={data.health.critical} icon={Activity} tone="red" />
        <Metric label="Advance Covered" value={data.counts.advance_covered} icon={WalletCards} tone="blue" />
      </section>

      <section className="grid gap-3 rounded-lg border bg-background p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search residents, admission, phone, room"
              className="pl-9"
            />
          </div>
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <Select value={roomFilter} onValueChange={setRoomFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Room" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rooms</SelectItem>
              {roomOptions.map(([roomId, roomLabel]) => (
                <SelectItem key={roomId} value={roomId}>
                  {roomLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((filter) => (
            <Button
              key={filter.key}
              type="button"
              size="sm"
              variant={quickFilter === filter.key ? "default" : "outline"}
              onClick={() => setQuickFilter(filter.key)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 overflow-x-auto pb-3 xl:grid-cols-4 2xl:grid-cols-6">
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn(
              "min-h-[360px] min-w-[280px] rounded-lg border bg-background",
              toneBorder(column.tone)
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b p-3">
              <div>
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {data.counts[column.key]} total
                </p>
              </div>
              <Badge className={toneBadge(column.tone)}>{column.cards.length}</Badge>
            </div>
            <div className="grid gap-3 p-3">
              {column.cards.map((card) => (
                <LifecycleCard key={card.residentId} card={card} />
              ))}
              {column.cards.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No residents in this lane.
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    </ResponsiveContainer>
  )
}

function LifecycleCard({ card }: { card: ResidentLifecycleCard }) {
  return (
    <article className="rounded-lg border bg-muted/20 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{card.residentName}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {card.admissionNumber ?? "No admission"} · {card.roomLabel ?? "No room"}
          </p>
        </div>
        <Badge variant={card.healthScore < 60 ? "destructive" : "secondary"}>
          {card.healthScore}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {card.stages.slice(0, 4).map((stage) => (
          <Badge key={stage} variant="outline" className="text-[10px]">
            {stage.replaceAll("_", " ")}
          </Badge>
        ))}
      </div>
      <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
        <p>
          Due: <span className="font-medium text-foreground">{formatCurrency(card.dueAmount)}</span>
        </p>
        <p>
          Advance:{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(card.advanceBalance)}
          </span>
        </p>
        {card.leaveStatus ? (
          <p className="flex items-center gap-1">
            <CalendarDays className="size-3" aria-hidden="true" />
            Leave {card.leaveStatus}
          </p>
        ) : null}
        {card.joinedOn ? <p>Joined {formatDate(card.joinedOn)}</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {card.healthReasons.map((reason) => (
          <span key={reason} className="text-[11px] text-muted-foreground">
            {reason}
          </span>
        ))}
      </div>
    </article>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone: ResidentLifecycleTone
}) {
  return (
    <article className={cn("rounded-lg border bg-background p-4", toneBorder(tone))}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </article>
  )
}

function toneBorder(tone: ResidentLifecycleTone) {
  return {
    red: "border-red-200",
    yellow: "border-amber-200",
    green: "border-emerald-200",
    blue: "border-sky-200",
    neutral: "border-border",
  }[tone]
}

function toneBadge(tone: ResidentLifecycleTone) {
  return {
    red: "bg-red-100 text-red-700 hover:bg-red-100",
    yellow: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    green: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    blue: "bg-sky-100 text-sky-700 hover:bg-sky-100",
    neutral: "bg-muted text-muted-foreground hover:bg-muted",
  }[tone]
}
