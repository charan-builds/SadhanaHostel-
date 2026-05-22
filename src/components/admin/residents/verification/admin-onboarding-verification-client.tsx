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
  const [rejectionReason, setRejectionReason] = useState("")
  const queue = useOnboardingQueue({
    organizationId: organizationId ?? "",
    hostelId,
    search: search || undefined,
    page: 1,
    pageSize: 50,
  })
  const review = useReviewOnboarding()
  const residents = queue.data?.data ?? []

  async function reviewResident(residentId: string, status: "verified" | "rejected") {
    if (!organizationId) {
      return
    }

    await review.mutateAsync({
      organizationId,
      residentId,
      status,
      rejectionReason: status === "rejected" ? rejectionReason : undefined,
    })
    setRejectionReason("")
    await queue.refetch()
    toast.success(status === "verified" ? "Resident verified." : "Resident rejected.")
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization access required"
        message="Complete admin setup before reviewing resident onboarding."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Resident Verification Queue"
        description="Review onboarding profiles, required document status, and approve dashboard access."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Queue" value={residents.length} />
        <Metric
          label="Ready"
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
          <CardTitle>Verification Worklist</CardTitle>
          <CardDescription>
            Approving a resident marks onboarding verified and unlocks resident operations.
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
              title="Verification queue could not be loaded"
              error={queue.error}
              onRetry={() => void queue.refetch()}
            />
          ) : residents.length === 0 && !queue.isLoading ? (
            <EmptyState
              title="No residents need verification"
              message="Newly activated residents appear here after they complete profile and document upload."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resident</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {residents.map((resident) => {
                    const docsComplete = Boolean(
                      resident.aadhaar_document_id &&
                        resident.profile_image_document_id &&
                        resident.student_id_document_id
                    )
                    const ready = resident.onboarding_status === "verification_pending"

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
                          <span className={docsComplete ? "text-emerald-700" : "text-amber-700"}>
                            {docsComplete ? "All required docs" : "Missing docs"}
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
                              Approve
                            </Button>
                            <Textarea
                              value={rejectionReason}
                              onChange={(event) => setRejectionReason(event.target.value)}
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
          )}
        </CardContent>
      </Card>
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
