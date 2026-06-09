"use client"

import { useState } from "react"
import { CheckCircle2, Search, ShieldCheck, XCircle } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { useOnboardingQueue, useReviewOnboarding } from "@/hooks"

export function AdminOnboardingVerificationClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [search, setSearch] = useState("")
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({})
  const queue = useOnboardingQueue({
    organizationId: organizationId ?? "",
    hostelId,
    search: search || undefined,
    page: 1,
    pageSize: 50,
  })
  const review = useReviewOnboarding()
  const residents = queue.data?.data ?? []

  function updateRejectionReason(residentId: string, value: string) {
    setRejectionReasons((current) => ({
      ...current,
      [residentId]: value,
    }))
  }

  async function reviewResident(residentId: string, status: "verified" | "rejected") {
    if (!organizationId) {
      return
    }

    const rejectionReason = rejectionReasons[residentId]?.trim()

    await review.mutateAsync({
      organizationId,
      residentId,
      status,
      rejectionReason: status === "rejected" ? rejectionReason : undefined,
    })
    setRejectionReasons((current) => {
      const next = { ...current }
      delete next[residentId]
      return next
    })
    await queue.refetch()
      toast.success(status === "verified" ? "Resident activated." : "Resident sent back.")
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Resident Onboarding Follow-up"
        description="Track incomplete or rejected profiles. Completed resident profiles activate automatically."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Queue" value={residents.length} />
        <Metric
          label="Legacy ready"
          value={residents.filter((resident) => resident.onboarding_status === "verification_pending").length}
        />
        <Metric
          label="Rejected"
          value={residents.filter((resident) => resident.onboarding_status === "rejected").length}
        />
        <Metric
          label="Incomplete"
          value={residents.filter((resident) => resident.onboarding_status !== "verification_pending").length}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding Worklist</CardTitle>
          <CardDescription>
            New residents activate when their profile and hostel rules are complete. Use this only
            for rejected profiles or older records that were already waiting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="relative">
            <span className="sr-only">Search onboarding residents</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-8"
              placeholder="Search name, phone, email, admission"
            />
          </label>

          {queue.isError ? (
            <APIErrorState
              title="Onboarding queue could not be loaded"
              error={queue.error}
              onRetry={() => void queue.refetch()}
            />
          ) : residents.length === 0 && !queue.isLoading ? (
            <EmptyState
              title="No onboarding follow-up needed"
              message="Residents disappear from this list after completing profile and hostel rules."
            />
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-3 lg:hidden">
                {residents.map((resident) => (
                  <OnboardingResidentCard
                    key={resident.id}
                    resident={resident}
                    rejectionReason={rejectionReasons[resident.id] ?? ""}
                    reviewPending={review.isPending}
                    onReasonChange={(value) => updateRejectionReason(resident.id, value)}
                    onReview={(status) => void reviewResident(resident.id, status)}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resident</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Profile</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {residents.map((resident) => {
                      const profileComplete = isProfileComplete(resident)
                      const ready = resident.onboarding_status === "verification_pending"
                      const rejectionReason = rejectionReasons[resident.id] ?? ""

                      return (
                        <TableRow key={resident.id}>
                          <TableCell>
                            <p className="font-medium">{resident.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {resident.admission_number}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p>{resident.phone ?? "-"}</p>
                            <p className="text-xs text-muted-foreground">
                              {resident.email ?? "No email"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className={profileComplete ? "text-emerald-700" : "text-amber-700"}>
                              {profileComplete ? "Profile ready" : "Profile incomplete"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={resident.onboarding_status ?? "profile_incomplete"} />
                          </TableCell>
                          <TableCell>{formatDateTime(resident.updated_at)}</TableCell>
                          <TableCell>
                            <div className="grid gap-2">
                              <Button
                                size="sm"
                                disabled={!ready || review.isPending}
                                onClick={() => void reviewResident(resident.id, "verified")}
                              >
                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                Activate
                              </Button>
                              <Textarea
                                value={rejectionReason}
                                onChange={(event) => updateRejectionReason(resident.id, event.target.value)}
                                placeholder="Reason for rejection"
                                className="min-h-16 min-w-56"
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={!rejectionReason.trim() || review.isPending}
                                onClick={() => void reviewResident(resident.id, "rejected")}
                              >
                                <XCircle className="size-3.5" aria-hidden="true" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function isProfileComplete(resident: {
  full_name: string | null
  date_of_birth: string | null
  phone: string | null
  parent_phone: string | null
  emergency_contact_phone: string | null
  permanent_address: string | null
  hostel_id: string | null
}) {
  return Boolean(
    resident.full_name &&
      resident.date_of_birth &&
      resident.phone &&
      resident.parent_phone &&
      resident.emergency_contact_phone &&
      resident.permanent_address &&
      resident.hostel_id
  )
}

function OnboardingResidentCard({
  resident,
  rejectionReason,
  reviewPending,
  onReasonChange,
  onReview,
}: {
  resident: {
    id: string
    full_name: string | null
    admission_number: string | null
    phone: string | null
    email: string | null
    date_of_birth: string | null
    parent_phone: string | null
    emergency_contact_phone: string | null
    permanent_address: string | null
    hostel_id: string | null
    onboarding_status?: string | null
    updated_at: string
  }
  rejectionReason: string
  reviewPending: boolean
  onReasonChange: (value: string) => void
  onReview: (status: "verified" | "rejected") => void
}) {
  const profileComplete = isProfileComplete(resident)
  const ready = resident.onboarding_status === "verification_pending"

  return (
    <div className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{resident.full_name}</p>
          <p className="text-xs text-muted-foreground">{resident.admission_number}</p>
        </div>
        <StatusBadge status={resident.onboarding_status ?? "profile_incomplete"} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Phone</p>
          <p className="font-medium">{resident.phone ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Updated</p>
          <p className="font-medium">{formatDateTime(resident.updated_at)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="truncate font-medium">{resident.email ?? "No email"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Profile</p>
          <p className={profileComplete ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
            {profileComplete ? "Profile ready" : "Profile incomplete"}
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Button
          size="sm"
          disabled={!ready || reviewPending}
          onClick={() => onReview("verified")}
        >
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Activate
        </Button>
        <Textarea
          value={rejectionReason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Reason for rejection"
          className="min-h-16"
        />
        <Button
          size="sm"
          variant="destructive"
          disabled={!rejectionReason.trim() || reviewPending}
          onClick={() => onReview("rejected")}
        >
          <XCircle className="size-3.5" aria-hidden="true" />
          Reject
        </Button>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <ShieldCheck className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
