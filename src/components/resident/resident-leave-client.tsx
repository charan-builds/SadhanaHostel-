"use client"

import Link from "next/link"
import type { Route } from "next"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarPlus, Loader2, ShieldCheck } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCreateLeave, useCurrentResident, useLeaves } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { FrontendApiError } from "@/lib/api-client"
import { formatDate, formatDateTime } from "@/lib/format"
import { useRealtimeLeaves } from "@/lib/realtime"
import type { Tables } from "@/types/database"

const leaveSchema = z
  .object({
    fromDate: z.string().min(1, "From date is required."),
    toDate: z.string().min(1, "Return date is required."),
    reason: z.string().trim().min(5, "Reason must be at least 5 characters."),
    destination: z.string().trim().max(200).optional(),
    travelMode: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.toDate >= value.fromDate, {
    path: ["toDate"],
    message: "Return date must be on or after from date.",
  })

type LeaveValues = z.infer<typeof leaveSchema>

export function ResidentLeaveClient() {
  const { organizationId, session } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const hostelId = resident.data?.hostel_id ?? session?.hostelIds[0]
  const leaves = useLeaves({
    organizationId: organizationId ?? "",
    hostelId,
    residentId: resident.data?.id,
    page: 1,
    pageSize: 50,
  })
  const createLeave = useCreateLeave()
  useRealtimeLeaves({
    enabled: Boolean(organizationId && resident.data?.id),
    residentId: resident.data?.id,
  })
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      fromDate: "",
      toDate: "",
      reason: "",
      destination: "",
      travelMode: "Bus",
      notes: "",
    },
  })
  const travelMode = useWatch({ control, name: "travelMode" })

  if (!organizationId) {
    return <EmptyState title="Organization access pending" message="Ask an admin to complete your account assignment." />
  }

  if (resident.isLoading) {
    return <LoadingState variant="cards" />
  }

  if (resident.error || !resident.data) {
    return (
      <APIErrorState
        title="Resident profile not linked"
        message="Your account is not connected to a resident profile."
        onRetry={() => void resident.refetch()}
      />
    )
  }

  const verification = getLeaveVerificationState(resident.data)

  if (!verification.canApplyLeave) {
    return (
      <div className="grid gap-6">
        <PageHeader
          title="Leave"
          description="Apply for leave and track approval or rejection status in realtime."
        />
        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Onboarding required</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {verification.message}
              </p>
              {verification.missing.length > 0 ? (
                <div className="mt-4 grid gap-2 text-sm">
                  {verification.missing.map((item) => (
                    <div key={item} className="rounded-lg border bg-muted/30 px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
              <Button asChild className="mt-5">
                <Link href={"/resident/onboarding" as Route}>Open onboarding</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function submitLeave(values: LeaveValues) {
    if (!organizationId || !resident.data) {
      return
    }

    try {
      await createLeave.mutateAsync({
        organizationId,
        hostelId: resident.data.hostel_id,
        residentId: resident.data.id,
        fromDate: values.fromDate,
        toDate: values.toDate,
        reason: values.reason,
        destination: values.destination || undefined,
        travelMode: values.travelMode || undefined,
        notes: values.notes || undefined,
      })
      await leaves.refetch()
      reset()
      toast.success("Leave request submitted.")
    } catch (error) {
      setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to submit leave request.",
      })
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leave"
        description="Apply for leave and track approval or rejection status in realtime."
      />

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={handleSubmit(submitLeave)} className="rounded-xl border bg-background p-5 shadow-sm">
          <h2 className="text-base font-semibold">Apply Leave</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit accurate dates and travel details so admins can notify your family when needed.
          </p>

          {errors.root?.message ? (
            <div className="mt-4">
              <APIErrorState title="Leave failed" message={errors.root.message} />
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fromDate">From date</Label>
              <Input id="fromDate" type="date" {...register("fromDate")} />
              {errors.fromDate ? <p className="text-xs text-destructive">{errors.fromDate.message}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="toDate">Return date</Label>
              <Input id="toDate" type="date" {...register("toDate")} />
              {errors.toDate ? <p className="text-xs text-destructive">{errors.toDate.message}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="travelMode">Travel mode</Label>
              <Select value={travelMode} onValueChange={(value) => setValue("travelMode", value)}>
                <SelectTrigger id="travelMode" className="h-9 w-full">
                  <SelectValue placeholder="Select travel mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bus">Bus</SelectItem>
                  <SelectItem value="Train">Train</SelectItem>
                  <SelectItem value="Bike">Bike</SelectItem>
                  <SelectItem value="Car">Car</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="destination">Destination</Label>
              <Input id="destination" {...register("destination")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" className="min-h-24" {...register("reason")} />
              {errors.reason ? <p className="text-xs text-destructive">{errors.reason.message}</p> : null}
            </div>
          </div>

          <Button type="submit" className="mt-5 w-full" disabled={isSubmitting || createLeave.isPending}>
            {isSubmitting || createLeave.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CalendarPlus className="size-4" aria-hidden="true" />
            )}
            Submit Leave Request
          </Button>
        </form>

        <DataTableShell
          title="Leave History"
          description="Approval status and request history."
          empty={
            leaves.data?.data.length === 0 ? (
              <EmptyState title="No leave requests" message="Submit your first leave request using the form." />
            ) : undefined
          }
        >
          {leaves.isLoading ? (
            <LoadingState variant="table" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dates</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Travel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.data?.data.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell>{formatDate(leave.from_date)} - {formatDate(leave.to_date)}</TableCell>
                    <TableCell>{leave.reason}</TableCell>
                    <TableCell>{leave.travel_mode ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={leave.status} />
                    </TableCell>
                    <TableCell>{formatDateTime(leave.reviewed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTableShell>
      </section>
    </div>
  )
}

type LeaveResident = Tables<"residents"> & {
  onboarding_status?: string | null
}

function getLeaveVerificationState(resident: LeaveResident) {
  const missing: string[] = []

  if (!resident.full_name) missing.push("Full name")
  if (!resident.date_of_birth) missing.push("Date of birth")
  if (!resident.phone) missing.push("Phone number")
  if (!resident.parent_phone) missing.push("Father phone")
  if (!resident.emergency_contact_phone) missing.push("Mother phone")
  if (!resident.permanent_address) missing.push("Permanent address")

  const canApplyLeave =
    resident.onboarding_status === "verified" &&
    resident.status === "active" &&
    resident.is_active !== false &&
    Boolean(resident.user_id) &&
    !resident.checkout_on

  if (canApplyLeave) {
    return {
      canApplyLeave,
      missing,
      message: "",
    }
  }

  if (missing.length > 0) {
    return {
      canApplyLeave,
      missing,
      message:
        "Finish the missing onboarding items below, then complete onboarding to unlock leave requests.",
    }
  }

  if (resident.onboarding_status === "verification_pending") {
    return {
      canApplyLeave,
      missing,
      message:
        "Your profile is complete and waiting to be activated. Open onboarding to finish.",
    }
  }

  return {
    canApplyLeave,
    missing,
    message:
      "Your resident profile must be complete and active before you can apply for leave.",
  }
}
