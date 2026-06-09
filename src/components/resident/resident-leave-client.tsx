"use client"

import type { Route } from "next"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCreateLeave, useCurrentResident, useLeaves, useLeaveSettings } from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import {
  buildUrgentLeaveWhatsappMessage,
  DEFAULT_LEAVE_REVIEW_NOTICE,
} from "@/lib/leaves/settings"
import { buildWhatsappUrl } from "@/lib/operations/whatsapp"
import { formatDate, formatDateTime } from "@/lib/format"
import { useRealtimeLeaves } from "@/lib/realtime"
import type { Tables } from "@/types/database"
import { phoneSchema } from "@/validations/common.validation"

const dateFieldSchema = (message: string) =>
  z
    .string()
    .min(1, message)
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")

const leaveSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required.").max(160),
    mobileNumber: phoneSchema,
    whatsappNumber: phoneSchema,
    fromDate: dateFieldSchema("From date is required."),
    toDate: dateFieldSchema("To date is required."),
    reason: z.string().trim().min(5, "Reason must be at least 5 characters.").max(1000),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.toDate >= value.fromDate, {
    path: ["toDate"],
    message: "To date must be on or after from date.",
  })

type LeaveFormInput = z.input<typeof leaveSchema>
type LeaveValues = z.output<typeof leaveSchema>
type SubmittedContact = {
  fullName: string
  mobileNumber: string
}

export function ResidentLeaveClient() {
  const { organizationId, session } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const hostelId = resident.data?.hostel_id ?? session?.hostelIds[0]
  const prefilledResidentId = useRef<string | null>(null)
  const [lastSubmittedLeave, setLastSubmittedLeave] = useState<Tables<"leave_requests"> | null>(null)
  const [lastSubmittedContact, setLastSubmittedContact] = useState<SubmittedContact | null>(null)
  const leaveSettingsQuery = useLeaveSettings(organizationId ?? undefined)
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
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormInput, unknown, LeaveValues>({
    resolver: zodResolver(leaveSchema),
    mode: "onBlur",
    shouldFocusError: true,
    defaultValues: {
      fullName: "",
      mobileNumber: "",
      whatsappNumber: "",
      fromDate: "",
      toDate: "",
      reason: "",
      notes: "",
    },
  })
  const watchedFullName = useWatch({ control, name: "fullName" }) ?? ""
  const watchedMobileNumber = useWatch({ control, name: "mobileNumber" }) ?? ""

  useEffect(() => {
    if (!resident.data || prefilledResidentId.current === resident.data.id) {
      return
    }

    reset({
      fullName: resident.data.full_name ?? "",
      mobileNumber: resident.data.phone ?? "",
      whatsappNumber: resident.data.phone ?? "",
      fromDate: "",
      toDate: "",
      reason: "",
      notes: "",
    })
    prefilledResidentId.current = resident.data.id
  }, [reset, resident.data])

  const reviewNotice =
    leaveSettingsQuery.data?.reviewNotice ?? DEFAULT_LEAVE_REVIEW_NOTICE
  const supportNumber = leaveSettingsQuery.data?.whatsappSupportNumber ?? ""
  const urgentEscalationEnabled =
    leaveSettingsQuery.data?.urgentWhatsappEscalationEnabled ?? true
  const currentEscalationUrl = useMemo(
    () =>
      urgentEscalationEnabled
        ? buildWhatsappUrl({
            phone: supportNumber,
            message: buildUrgentLeaveWhatsappMessage({
              studentName: watchedFullName,
              mobileNumber: watchedMobileNumber,
            }),
          })
        : null,
    [supportNumber, urgentEscalationEnabled, watchedFullName, watchedMobileNumber]
  )

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
  const leaveRows = leaves.data?.data ?? []
  const submittedLeave = lastSubmittedLeave
    ? leaveRows.find((leave) => leave.id === lastSubmittedLeave.id) ?? lastSubmittedLeave
    : null

  if (!verification.canApplyLeave) {
    return (
      <div className="grid gap-6">
        <PageHeader
          title="Leave"
          description="Submit a leave request and track review status."
        />
        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Resident access required</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {verification.message}
              </p>
              <Button asChild className="mt-5 h-11">
                <Link href={"/resident/profile" as Route}>Open profile</Link>
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
      const createdLeave = await createLeave.mutateAsync({
        organizationId,
        hostelId: resident.data.hostel_id,
        residentId: resident.data.id,
        fullName: values.fullName,
        mobileNumber: values.mobileNumber,
        whatsappNumber: values.whatsappNumber,
        fromDate: values.fromDate,
        toDate: values.toDate,
        reason: values.reason,
        notes: values.notes || undefined,
      })
      await leaves.refetch()
      setLastSubmittedLeave(createdLeave)
      setLastSubmittedContact({
        fullName: values.fullName,
        mobileNumber: values.mobileNumber,
      })
      reset({
        fullName: values.fullName,
        mobileNumber: values.mobileNumber,
        whatsappNumber: values.whatsappNumber,
        fromDate: "",
        toDate: "",
        reason: "",
        notes: "",
      })
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
    <div className="grid min-w-0 gap-6 pb-24 sm:pb-0">
      <PageHeader
        title="Leave"
        description="Submit leave quickly and track hostel review status."
      />

      {submittedLeave ? (
        <LeaveSubmissionStatus
          leave={submittedLeave}
          contact={lastSubmittedContact}
          supportNumber={supportNumber}
          urgentEscalationEnabled={urgentEscalationEnabled}
        />
      ) : null}

      <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <form
          onSubmit={handleSubmit(submitLeave)}
          className="min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm"
        >
          <div className="grid gap-5 p-4 sm:p-5">
            <div>
              <h2 className="text-base font-semibold">Apply Leave</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Fill the essentials and submit. Hostel management can review the request from admin.
              </p>
            </div>

            {errors.root?.message ? (
              <APIErrorState title="Leave failed" message={errors.root.message} />
            ) : null}

            <div className="grid gap-4">
              <FormField label="Full Name" error={errors.fullName?.message} errorId="fullName-error">
                <Input
                  id="fullName"
                  className="h-12 text-base"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? "fullName-error" : undefined}
                  {...register("fullName")}
                />
              </FormField>

              <FormField
                label="Mobile Number"
                error={errors.mobileNumber?.message}
                errorId="mobileNumber-error"
              >
                <Input
                  id="mobileNumber"
                  className="h-12 text-base"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.mobileNumber)}
                  aria-describedby={errors.mobileNumber ? "mobileNumber-error" : undefined}
                  {...register("mobileNumber")}
                />
              </FormField>

              <FormField
                label="WhatsApp Number"
                error={errors.whatsappNumber?.message}
                errorId="whatsappNumber-error"
              >
                <Input
                  id="whatsappNumber"
                  className="h-12 text-base"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.whatsappNumber)}
                  aria-describedby={errors.whatsappNumber ? "whatsappNumber-error" : undefined}
                  {...register("whatsappNumber")}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="From Date" error={errors.fromDate?.message} errorId="fromDate-error">
                  <Input
                    id="fromDate"
                    type="date"
                    className="h-12 text-base"
                    aria-invalid={Boolean(errors.fromDate)}
                    aria-describedby={errors.fromDate ? "fromDate-error" : undefined}
                    {...register("fromDate")}
                  />
                </FormField>

                <FormField label="To Date" error={errors.toDate?.message} errorId="toDate-error">
                  <Input
                    id="toDate"
                    type="date"
                    className="h-12 text-base"
                    aria-invalid={Boolean(errors.toDate)}
                    aria-describedby={errors.toDate ? "toDate-error" : undefined}
                    {...register("toDate")}
                  />
                </FormField>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  className="min-h-28 resize-y text-base"
                  aria-invalid={Boolean(errors.reason)}
                  aria-describedby={errors.reason ? "reason-hint reason-error" : "reason-hint"}
                  {...register("reason")}
                />
                <p id="reason-hint" className="text-xs text-muted-foreground">
                  A short reason is enough.
                </p>
                <FormErrorText id="reason-error" message={errors.reason?.message} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Emergency Notes (optional)</Label>
                <Textarea
                  id="notes"
                  className="min-h-24 resize-y text-base"
                  aria-invalid={Boolean(errors.notes)}
                  aria-describedby={errors.notes ? "notes-error" : undefined}
                  {...register("notes")}
                />
                <FormErrorText id="notes-error" message={errors.notes?.message} />
              </div>
            </div>

            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <p>{reviewNotice}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">Need urgent approval?</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    If your leave is urgent, contact hostel management directly on WhatsApp for faster review.
                  </p>
                  <div className="mt-3">
                    <WhatsAppEscalationButton
                      url={currentEscalationUrl}
                      enabled={urgentEscalationEnabled}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur sm:static sm:p-5 sm:pt-0">
            <Button
              type="submit"
              className="h-12 w-full"
              disabled={isSubmitting || createLeave.isPending}
            >
              {isSubmitting || createLeave.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CalendarPlus className="size-4" aria-hidden="true" />
              )}
              Submit Leave Request
            </Button>
          </div>
        </form>

        <DataTableShell
          title="Leave History"
          description="Approval status and request history."
          empty={
            !leaves.isLoading && leaveRows.length === 0 ? (
              <EmptyState title="No leave requests" message="Submit your first leave request using the form." />
            ) : undefined
          }
        >
          {leaves.isLoading ? (
            <LoadingState variant="table" />
          ) : (
            <div className="grid min-w-0 gap-3 p-3 lg:block lg:p-0">
              <div className="grid gap-3 lg:hidden">
                {leaveRows.map((leave) => (
                  <ResidentLeaveHistoryCard
                    key={leave.id}
                    leave={leave}
                    resident={resident.data}
                    supportNumber={supportNumber}
                    urgentEscalationEnabled={urgentEscalationEnabled}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dates</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reviewed</TableHead>
                      <TableHead className="text-right">Escalation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRows.map((leave) => {
                      const escalationUrl = getLeaveEscalationUrl({
                        leave,
                        resident: resident.data,
                        supportNumber,
                        urgentEscalationEnabled,
                      })

                      return (
                        <TableRow key={leave.id}>
                          <TableCell>{formatDate(leave.from_date)} - {formatDate(leave.to_date)}</TableCell>
                          <TableCell className="max-w-80 truncate">{leave.reason}</TableCell>
                          <TableCell>
                            <StatusBadge status={leave.status} />
                          </TableCell>
                          <TableCell>{formatDateTime(leave.reviewed_at)}</TableCell>
                          <TableCell className="text-right">
                            {leave.status === "pending" ? (
                              <WhatsAppEscalationButton
                                url={escalationUrl}
                                enabled={urgentEscalationEnabled}
                                compact
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DataTableShell>
      </section>
    </div>
  )
}

function FormField({
  label,
  error,
  errorId,
  children,
}: {
  label: string
  error?: string
  errorId: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={errorId.replace("-error", "")}>{label}</Label>
      {children}
      <FormErrorText id={errorId} message={error} />
    </div>
  )
}

function FormErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null
  }

  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )
}

function LeaveSubmissionStatus({
  leave,
  contact,
  supportNumber,
  urgentEscalationEnabled,
}: {
  leave: Tables<"leave_requests">
  contact: SubmittedContact | null
  supportNumber: string
  urgentEscalationEnabled: boolean
}) {
  const escalationUrl =
    leave.status === "pending"
      ? buildWhatsappUrl({
          phone: supportNumber,
          message: buildUrgentLeaveWhatsappMessage({
            studentName: contact?.fullName,
            mobileNumber: contact?.mobileNumber,
          }),
        })
      : null

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 shadow-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Leave Submitted Successfully</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <StatusLine label="Status" value={getLeaveStatusLabel(leave.status)} />
            <StatusLine label="Estimated review time" value="Usually 1–2 days." />
          </div>
          {leave.status === "pending" ? (
            <div className="mt-4">
              <WhatsAppEscalationButton
                url={escalationUrl}
                enabled={urgentEscalationEnabled}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-white/70 px-3 py-2">
      <span className="block text-xs font-medium uppercase text-emerald-800">{label}</span>
      <span className="mt-1 block font-semibold">{value}</span>
    </div>
  )
}

function ResidentLeaveHistoryCard({
  leave,
  resident,
  supportNumber,
  urgentEscalationEnabled,
}: {
  leave: Tables<"leave_requests">
  resident: Tables<"residents">
  supportNumber: string
  urgentEscalationEnabled: boolean
}) {
  const escalationUrl = getLeaveEscalationUrl({
    leave,
    resident,
    supportNumber,
    urgentEscalationEnabled,
  })

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {formatDate(leave.from_date)} - {formatDate(leave.to_date)}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {leave.reason}
          </p>
        </div>
        <StatusBadge status={leave.status} />
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <ResidentLeaveInfo
          label="Submitted"
          value={formatDateTime(leave.created_at)}
        />
        <ResidentLeaveInfo
          label="Reviewed"
          value={leave.reviewed_at ? formatDateTime(leave.reviewed_at) : "Waiting for review"}
        />
      </div>

      {leave.status === "pending" ? (
        <div className="mt-4">
          <WhatsAppEscalationButton
            url={escalationUrl}
            enabled={urgentEscalationEnabled}
          />
        </div>
      ) : null}

      {leave.rejection_reason ? (
        <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm leading-6 text-destructive">
          {leave.rejection_reason}
        </p>
      ) : null}
    </article>
  )
}

function ResidentLeaveInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  )
}

function WhatsAppEscalationButton({
  url,
  enabled,
  compact = false,
}: {
  url: string | null
  enabled: boolean
  compact?: boolean
}) {
  const className = compact ? "h-9" : "h-11 w-full sm:w-auto"

  if (!enabled || !url) {
    return (
      <Button type="button" variant="outline" className={className} disabled>
        <MessageCircle className="size-4" aria-hidden="true" />
        Contact on WhatsApp
      </Button>
    )
  }

  return (
    <Button asChild variant="outline" className={className}>
      <a href={url} target="_blank" rel="noreferrer">
        <MessageCircle className="size-4" aria-hidden="true" />
        Contact on WhatsApp
      </a>
    </Button>
  )
}

function getLeaveEscalationUrl(input: {
  leave: Tables<"leave_requests">
  resident: Tables<"residents">
  supportNumber: string
  urgentEscalationEnabled: boolean
}) {
  if (!input.urgentEscalationEnabled || input.leave.status !== "pending") {
    return null
  }

  const contact = getSubmittedContact(input.leave, input.resident)

  return buildWhatsappUrl({
    phone: input.supportNumber,
    message: buildUrgentLeaveWhatsappMessage({
      studentName: contact.fullName,
      mobileNumber: contact.mobileNumber,
    }),
  })
}

function getSubmittedContact(
  leave: Tables<"leave_requests">,
  resident: Tables<"residents">
): SubmittedContact {
  const metadata = recordFromUnknown(leave.metadata)

  return {
    fullName: stringFromRecord(metadata, "submittedStudentName") ?? resident.full_name,
    mobileNumber: stringFromRecord(metadata, "submittedMobileNumber") ?? resident.phone ?? "",
  }
}

function getLeaveStatusLabel(status: Tables<"leave_requests">["status"]) {
  if (status === "pending") {
    return "Waiting for review"
  }

  if (status === "approved") {
    return "Approved"
  }

  if (status === "rejected") {
    return "Rejected"
  }

  return status
}

type LeaveResident = Tables<"residents"> & {
  onboarding_status?: string | null
}

function getLeaveVerificationState(resident: LeaveResident) {
  const canApplyLeave =
    resident.status === "active" &&
    resident.is_active !== false &&
    resident.onboarding_status !== "suspended" &&
    Boolean(resident.user_id) &&
    !resident.checkout_on

  if (canApplyLeave) {
    return {
      canApplyLeave,
      message: "",
    }
  }

  if (resident.checkout_on) {
    return {
      canApplyLeave,
      message: "Checked-out residents cannot submit new leave requests.",
    }
  }

  if (resident.onboarding_status === "suspended" || resident.status === "suspended") {
    return {
      canApplyLeave,
      message: "Your resident account is suspended. Contact hostel management before applying leave.",
    }
  }

  if (!resident.user_id) {
    return {
      canApplyLeave,
      message: "Your portal account must be linked before applying leave.",
    }
  }

  return {
    canApplyLeave,
    message: "Your resident account must be active before applying leave.",
  }
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]

  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
