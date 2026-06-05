"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, Loader2, Plus, Search } from "lucide-react"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { filterCollectionRows } from "@/lib/finance/collection-center"
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { useCollectionFollowups, useCompleteCollectionFollowup, useCreateCollectionFollowup, useFinanceDashboard } from "@/hooks"
import type { CollectionFollowupPriority } from "@/validations/finance.validation"

export function AdminFollowupsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const actorUserId = session?.user?.id
  const [search, setSearch] = useState("")
  const [residentId, setResidentId] = useState("")
  const [notes, setNotes] = useState("")
  const [nextFollowupAt, setNextFollowupAt] = useState("")
  const [priority, setPriority] = useState<CollectionFollowupPriority>("medium")
  const dashboard = useFinanceDashboard(
    organizationId
      ? {
          organizationId,
          hostelId,
        }
      : undefined
  )
  const followups = useCollectionFollowups(
    organizationId
      ? {
          organizationId,
          hostelId,
          limit: 100,
        }
      : undefined
  )
  const createFollowup = useCreateCollectionFollowup()
  const completeFollowup = useCompleteCollectionFollowup()
  const rows = useMemo(
    () => dashboard.data?.residentFinance ?? [],
    [dashboard.data?.residentFinance]
  )
  const filteredRows = useMemo(() => filterCollectionRows(rows, search), [rows, search])
  const residentNameById = useMemo(
    () => new Map(rows.map((row) => [row.resident.id, row.resident.full_name])),
    [rows]
  )
  const openFollowups = (followups.data ?? []).filter((followup) => followup.status === "open")
  const completedFollowups = (followups.data ?? []).filter(
    (followup) => followup.status === "completed"
  )

  async function create() {
    if (!organizationId || !actorUserId) {
      return
    }

    const selectedResidentId = residentId || filteredRows[0]?.resident.id

    if (!selectedResidentId) {
      toast.error("Choose a resident before saving a follow-up.")
      return
    }

    await createFollowup.mutateAsync({
      organizationId,
      hostelId,
      residentId: selectedResidentId,
      notes,
      priority,
      assignedTo: actorUserId,
      ...(nextFollowupAt ? { nextFollowupAt: new Date(nextFollowupAt).toISOString() } : {}),
      status: "open",
    })
    setNotes("")
    setNextFollowupAt("")
    setResidentId("")
    toast.success("Follow-up saved.")
  }

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
        title="Followups"
        description="Schedule, assign, and complete collection follow-ups."
        badge={`${openFollowups.length} open`}
      />

      {dashboard.isLoading || followups.isLoading ? <LoadingState variant="dashboard" /> : null}
      {dashboard.isError ? (
        <APIErrorState
          title="Residents could not be loaded"
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}
      {followups.isError ? (
        <APIErrorState
          title="Follow-ups could not be loaded"
          error={followups.error}
          onRetry={() => void followups.refetch()}
        />
      ) : null}

      {!dashboard.isLoading && !followups.isLoading ? (
        <>
          <section className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px]">
              <div className="grid gap-2">
                <Label htmlFor="followup-search">Resident</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="followup-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Search resident, phone, admission, invoice, receipt"
                  />
                </div>
                <Select value={residentId} onValueChange={setResidentId}>
                  <SelectTrigger>
                    <SelectValue placeholder={filteredRows[0]?.resident.full_name ?? "Choose resident"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRows.slice(0, 50).map((row) => (
                      <SelectItem key={row.resident.id} value={row.resident.id}>
                        {row.resident.full_name} · {row.resident.admission_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="followup-priority">Priority</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as CollectionFollowupPriority)}>
                  <SelectTrigger id="followup-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="followup-next">Next follow-up</Label>
                <Input
                  id="followup-next"
                  type="datetime-local"
                  value={nextFollowupAt}
                  onChange={(event) => setNextFollowupAt(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <Label htmlFor="followup-notes">Notes</Label>
              <Textarea
                id="followup-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Call outcome, promise date, parent update, or next collection step."
              />
              <Button
                type="button"
                className="justify-self-start"
                disabled={createFollowup.isPending || notes.trim().length === 0}
                onClick={() => void create()}
              >
                {createFollowup.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Save Follow-up
              </Button>
            </div>
          </section>

          <FollowupList
            title="Open Followups"
            rows={openFollowups}
            residentNameById={residentNameById}
            completing={completeFollowup.isPending}
            onComplete={(followupId) =>
              completeFollowup.mutateAsync({
                organizationId,
                hostelId,
                followupId,
                notes: "Marked complete from Collection Center.",
              })
            }
          />
          <FollowupList
            title="Completed Followups"
            rows={completedFollowups}
            residentNameById={residentNameById}
            completing={false}
          />
        </>
      ) : null}
    </ResponsiveContainer>
  )
}

function FollowupList({
  title,
  rows,
  residentNameById,
  completing,
  onComplete,
}: {
  title: string
  rows: NonNullable<ReturnType<typeof useCollectionFollowups>["data"]>
  residentNameById: Map<string, string>
  completing: boolean
  onComplete?: (followupId: string) => Promise<unknown>
}) {
  return (
    <section className="rounded-xl border bg-card shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <div className="divide-y">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No follow-ups" message="Saved collection follow-ups appear here." />
          </div>
        ) : (
          rows.map((followup) => (
            <article key={followup.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">
                    {residentNameById.get(followup.resident_id) ?? "Resident"}
                  </p>
                  <Badge variant="secondary">{humanizeEnum(followup.priority)}</Badge>
                  <StatusBadge status={followup.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{followup.note}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Created {formatDateTime(followup.created_at)}
                  {followup.next_followup_at
                    ? ` · Next ${formatDateTime(followup.next_followup_at)}`
                    : ""}
                </p>
              </div>
              {onComplete ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={completing}
                  onClick={() => void onComplete(followup.id)}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Complete
                </Button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
