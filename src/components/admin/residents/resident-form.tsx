"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import type { Route } from "next"
import { Banknote, Copy, ExternalLink, KeyRound, Loader2, MessageCircle, Save, UserPlus } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { APIErrorState } from "@/components/system"
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
import { hostelModules } from "@/config/hostel-modules"
import { HOSTEL_FEES } from "@/constants/hostel"
import { useAuth } from "@/lib/auth"
import { FrontendApiError } from "@/lib/api-client"
import { formatCurrency } from "@/lib/format"
import { useAdmissionsVacancy, useCreateResident, useCreateResidentInvite, useUpdateResident } from "@/hooks"
import type { ResidentInviteCreated } from "@/types/invites"
import type { Tables } from "@/types/database"

const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined)

const phoneFormSchema = z
  .string()
  .trim()
  .min(8, "Phone number is required for onboarding access.")
  .max(20)
  .regex(/^[+0-9\s-]+$/, "Phone number contains unsupported characters.")

const optionalPhoneFormSchema = optionalTextSchema.pipe(phoneFormSchema.optional())

const residentFormSchema = z.object({
  admissionNumber: z.string().trim().max(50).optional(),
  fullName: z.string().trim().min(2, "Full name is required."),
  preferredName: optionalTextSchema.pipe(z.string().max(80).optional()),
  residentType: z.enum(["student", "employee", "other"]),
  gender: optionalTextSchema.pipe(z.string().max(40).optional()),
  dateOfBirth: optionalTextSchema,
  phone: optionalPhoneFormSchema,
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  parentPhone: optionalPhoneFormSchema,
  emergencyContactPhone: optionalPhoneFormSchema,
  permanentAddress: optionalTextSchema.pipe(z.string().max(500).optional()),
  monthlyFeeAmount: z.coerce.number().nonnegative(),
  securityDepositAmount: z.coerce.number().nonnegative(),
  advancePaymentStatus: z.enum(["not_paid", "paid"]).default("not_paid"),
  advancePaymentAmount: z.coerce.number().nonnegative(),
  advancePaymentMethod: z.enum(["cash", "bank_transfer"]).default("cash"),
  advanceManualReference: optionalTextSchema.pipe(z.string().max(120).optional()),
  advanceNotes: optionalTextSchema.pipe(z.string().max(1000).optional()),
  firstMonthFeeStatus: z.enum(["not_paid", "paid"]).default("not_paid"),
  firstMonthFeeAmount: z.coerce.number().nonnegative(),
  firstMonthFeeMethod: z.enum(["cash", "bank_transfer"]).default("cash"),
  firstMonthFeeManualReference: optionalTextSchema.pipe(z.string().max(120).optional()),
  firstMonthFeeNotes: optionalTextSchema.pipe(z.string().max(1000).optional()),
  roomId: z.string().uuid("Choose an available room.").optional().or(z.literal("")),
  bedLabel: optionalTextSchema.pipe(z.string().max(40).optional()),
  allocatedFrom: optionalTextSchema,
  notes: optionalTextSchema.pipe(z.string().max(1000).optional()),
  status: z.enum(["draft", "active", "suspended", "checked_out", "archived"]).optional(),
}).superRefine((value, context) => {
  if (value.advancePaymentStatus === "paid" && value.advancePaymentAmount <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["advancePaymentAmount"],
      message: "Enter the advance amount received.",
    })
  }

  if (value.firstMonthFeeStatus === "paid" && value.firstMonthFeeAmount <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["firstMonthFeeAmount"],
      message: "Enter the first month fee received.",
    })
  }
})

type ResidentFormInput = z.input<typeof residentFormSchema>
type ResidentFormValues = z.output<typeof residentFormSchema>

type ResidentFormProps = {
  resident?: Tables<"residents">
  onSaved?: (resident: Tables<"residents">) => void
  onCancel?: () => void
}

type DuplicateResidentDetails = {
  type?: string
  matchedFields?: readonly string[]
  resident?: {
    id?: string
    fullName?: string
    admissionNumber?: string
    phone?: string | null
    email?: string | null
    status?: string
    hasPortalAccount?: boolean
  }
}

export function ResidentForm({ resident, onSaved, onCancel }: ResidentFormProps) {
  const { organizationId, session } = useAuth()
  const hostelId = resident?.hostel_id ?? session?.hostelIds[0] ?? null
  const createResident = useCreateResident()
  const updateResident = useUpdateResident()
  const createInvite = useCreateResidentInvite()
  const [accessMode, setAccessMode] = useState<"activation_link" | "temporary_password">(
    "activation_link"
  )
  const [createdResident, setCreatedResident] = useState<Tables<"residents"> | null>(null)
  const [createdInvite, setCreatedInvite] = useState<ResidentInviteCreated | null>(null)
  const [createdAdvancePayment, setCreatedAdvancePayment] = useState<Tables<"payments"> | null>(null)
  const [createdFirstMonthFeePayment, setCreatedFirstMonthFeePayment] = useState<Tables<"payments"> | null>(null)
  const [duplicateDetails, setDuplicateDetails] = useState<DuplicateResidentDetails | null>(null)
  const vacancyQuery = useAdmissionsVacancy({
    organizationId: organizationId ?? "",
    hostelId: hostelId ?? undefined,
  })
  const availableRooms =
    vacancyQuery.data?.rooms.filter(
      (room) => room.room_status === "active" && room.available_beds > 0
    ) ?? []
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResidentFormInput, unknown, ResidentFormValues>({
    resolver: zodResolver(residentFormSchema),
    defaultValues: {
      admissionNumber: resident?.admission_number ?? "",
      fullName: resident?.full_name ?? "",
      preferredName: resident?.preferred_name ?? "",
      residentType: resident?.resident_type ?? "student",
      gender: resident?.gender ?? "",
      dateOfBirth: resident?.date_of_birth ?? "",
      phone: resident?.phone ?? "",
      email: resident?.email ?? "",
      parentPhone: resident?.parent_phone ?? "",
      emergencyContactPhone: resident?.emergency_contact_phone ?? "",
      permanentAddress: resident?.permanent_address ?? "",
      monthlyFeeAmount: resident?.monthly_fee_amount ?? HOSTEL_FEES.student,
      securityDepositAmount: resident?.security_deposit_amount ?? 0,
      advancePaymentStatus: "not_paid",
      advancePaymentAmount: resident?.monthly_fee_amount ?? HOSTEL_FEES.student,
      advancePaymentMethod: "cash",
      advanceManualReference: "",
      advanceNotes: "",
      firstMonthFeeStatus: "not_paid",
      firstMonthFeeAmount: resident?.monthly_fee_amount ?? HOSTEL_FEES.student,
      firstMonthFeeMethod: "cash",
      firstMonthFeeManualReference: "",
      firstMonthFeeNotes: "",
      roomId: "",
      bedLabel: "",
      allocatedFrom: new Date().toISOString().slice(0, 10),
      notes: resident?.notes ?? "",
      status: resident?.status ?? "draft",
    },
  })
  const isCreate = !resident
  const advancePaymentStatus = useWatch({ control, name: "advancePaymentStatus" })
  const firstMonthFeeStatus = useWatch({ control, name: "firstMonthFeeStatus" })
  const currentMonthlyFee = useWatch({ control, name: "monthlyFeeAmount" })

  async function onSubmit(values: ResidentFormValues) {
    if (!organizationId || !hostelId) {
      setError("root", {
        message: "Sadhana Boys Hostel context is still being applied. Refresh and try again.",
      })
      return
    }

    const onboardingPhone = values.phone

    if (!resident && !onboardingPhone) {
      setError("phone", {
        message: "Phone number is required to send resident onboarding access.",
      })
      return
    }

    try {
      setDuplicateDetails(null)
      setCreatedInvite(null)
      setCreatedResident(null)
      setCreatedAdvancePayment(null)
      setCreatedFirstMonthFeePayment(null)

      let savedResident: Tables<"residents">
      let generatedInvite: ResidentInviteCreated | null = null

      if (resident) {
        savedResident = await updateResident.mutateAsync({
            residentId: resident.id,
            organizationId,
            fullName: values.fullName,
            preferredName: values.preferredName || undefined,
            residentType: values.residentType,
            gender: values.gender || undefined,
            dateOfBirth: values.dateOfBirth || undefined,
            phone: values.phone || undefined,
            email: values.email || undefined,
            parentPhone: values.parentPhone || undefined,
            emergencyContactPhone: values.emergencyContactPhone || undefined,
            permanentAddress: values.permanentAddress || undefined,
            monthlyFeeAmount:
              values.residentType === "student" ? HOSTEL_FEES.student : values.monthlyFeeAmount,
            securityDepositAmount: values.securityDepositAmount,
            notes: values.notes || undefined,
            status: values.status,
          })
      } else {
        const createResult = await createResident.mutateAsync({
            organizationId,
            hostelId,
            admissionNumber: values.admissionNumber || undefined,
            fullName: values.fullName,
            preferredName: values.preferredName || undefined,
            residentType: values.residentType,
            gender: undefined,
            dateOfBirth: undefined,
            phone: onboardingPhone ?? "",
            email: values.email || undefined,
            parentPhone: undefined,
            emergencyContactPhone: undefined,
            permanentAddress: undefined,
            monthlyFeeAmount:
              values.residentType === "student" ? HOSTEL_FEES.student : values.monthlyFeeAmount,
            securityDepositAmount: values.securityDepositAmount,
            advancePaymentAmount:
              values.advancePaymentStatus === "paid" ? values.advancePaymentAmount : undefined,
            advancePaymentMethod: values.advancePaymentMethod,
            advanceManualReference: values.advanceManualReference || undefined,
            advanceNotes: values.advanceNotes || undefined,
            firstMonthFeeAmount:
              values.firstMonthFeeStatus === "paid" ? values.firstMonthFeeAmount : undefined,
            firstMonthFeeMethod: values.firstMonthFeeMethod,
            firstMonthFeeManualReference: values.firstMonthFeeManualReference || undefined,
            firstMonthFeeNotes: values.firstMonthFeeNotes || undefined,
            roomId: values.roomId || undefined,
            bedLabel: undefined,
            allocatedFrom: values.allocatedFrom || undefined,
            notes: values.notes || undefined,
            inviteDeliveryChannel:
              accessMode === "temporary_password" ? "temp_password" : "whatsapp",
            inviteExpiresInHours: 72,
          })

        savedResident = createResult.resident
        generatedInvite = createResult.invite
        setCreatedAdvancePayment(createResult.advancePayment)
        setCreatedFirstMonthFeePayment(createResult.firstMonthFeePayment)
      }

      if (!resident) {
        setCreatedResident(savedResident)
        setCreatedInvite(generatedInvite)

        toast.success(
          accessMode === "temporary_password"
            ? "Resident created and temporary phone login is ready."
            : "Resident created and WhatsApp onboarding link is ready."
        )
      } else {
        toast.success("Resident updated.")
      }

      onSaved?.(savedResident)
    } catch (error) {
      if (error instanceof FrontendApiError && error.code === "CONFLICT") {
        const duplicate = parseDuplicateDetails(error.details)

        if (duplicate) {
          setDuplicateDetails(duplicate)
        }
      }

      setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to save resident. Please try again.",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border bg-background p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isCreate ? "Quick Resident Admission" : "Resident Information"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCreate
            ? "Add the resident in seconds. They will complete contact, father phone, mother phone, address, and hostel rules through self-onboarding."
            : "Update resident profile data through the production API."}
        </p>
      </div>

      {errors.root?.message ? (
        <div className="mt-5">
          <APIErrorState title="Could not save resident" message={errors.root.message} />
        </div>
      ) : null}

      {duplicateDetails ? (
        <DuplicateResidentRecovery
          details={duplicateDetails}
          organizationId={organizationId}
          resendInvite={async () => {
            const residentId = duplicateDetails.resident?.id

            if (!organizationId || !residentId) {
              return
            }

            const invite = await createInvite.mutateAsync({
              organizationId,
              residentId,
              deliveryChannel: "whatsapp",
              expiresInHours: 72,
            })

            setCreatedInvite(invite)
            toast.success("Activation link regenerated for the existing resident.")
          }}
          isResending={createInvite.isPending}
        />
      ) : null}

      {createdResident ? (
        <CreatedResidentAccessPanel
          resident={createdResident}
          invite={createdInvite}
          advancePayment={createdAdvancePayment}
          firstMonthFeePayment={createdFirstMonthFeePayment}
          invitePending={createInvite.isPending}
        />
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {!isCreate ? (
          <Field id="admissionNumber" label="Admission number" error={errors.admissionNumber?.message}>
            <Input
              id="admissionNumber"
              disabled={Boolean(resident)}
              {...register("admissionNumber")}
            />
          </Field>
        ) : null}
        <Field id="fullName" label="Full name" error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" {...register("fullName")} />
        </Field>
        {!isCreate ? (
          <Field id="preferredName" label="Preferred name" error={errors.preferredName?.message}>
            <Input id="preferredName" {...register("preferredName")} />
          </Field>
        ) : null}
        <Field id="residentType" label="Resident type" error={errors.residentType?.message}>
          <Controller
            control={control}
            name="residentType"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  if (value === "student" || value === "employee") {
                    const feeAmount =
                      value === "employee" ? HOSTEL_FEES.employee : HOSTEL_FEES.student
                    setValue(
                      "monthlyFeeAmount",
                      feeAmount,
                      { shouldValidate: true }
                    )
                    if (advancePaymentStatus === "paid") {
                      setValue("advancePaymentAmount", feeAmount, { shouldValidate: true })
                    }
                    if (firstMonthFeeStatus === "paid") {
                      setValue("firstMonthFeeAmount", feeAmount, { shouldValidate: true })
                    }
                  }
                }}
              >
                <SelectTrigger id="residentType" className="h-9 w-full">
                  <SelectValue placeholder="Select resident type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field
          id="phone"
          label={isCreate ? "Phone for WhatsApp onboarding" : "Phone"}
          error={errors.phone?.message}
        >
          <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
        </Field>
        {!isCreate ? (
          <>
            <Field id="email" label="Email (optional)" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
            </Field>
            <Field id="parentPhone" label="Father phone" error={errors.parentPhone?.message}>
              <Input id="parentPhone" type="tel" {...register("parentPhone")} />
            </Field>
            <Field id="emergencyContactPhone" label="Mother phone" error={errors.emergencyContactPhone?.message}>
              <Input id="emergencyContactPhone" type="tel" {...register("emergencyContactPhone")} />
            </Field>
          </>
        ) : null}
        <Field id="monthlyFeeAmount" label="Monthly fee" error={errors.monthlyFeeAmount?.message}>
          <Input id="monthlyFeeAmount" type="number" readOnly {...register("monthlyFeeAmount")} />
        </Field>
        {!isCreate ? (
          <Field id="securityDepositAmount" label="Security deposit" error={errors.securityDepositAmount?.message}>
            <Input id="securityDepositAmount" type="number" {...register("securityDepositAmount")} />
          </Field>
        ) : null}
        {isCreate ? (
          <div className="md:col-span-2 rounded-lg border border-dashed bg-muted/30 p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-start">
              <div className="text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <Banknote className="size-4 text-primary" aria-hidden="true" />
                  Advance paid at admission
                </p>
                <p className="mt-1 text-muted-foreground">
                  Mark this when the resident has already paid advance. It is saved as a
                  verified advance payment and appears in the admin and resident ledgers.
                </p>
              </div>
              <Field id="advancePaymentStatus" label="Advance status" error={errors.advancePaymentStatus?.message}>
                <Controller
                  control={control}
                  name="advancePaymentStatus"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        if (value === "paid") {
                          setValue("advancePaymentAmount", currentMonthlyFee, {
                            shouldValidate: true,
                          })
                        }
                      }}
                    >
                      <SelectTrigger id="advancePaymentStatus" className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_paid">Not paid yet</SelectItem>
                        <SelectItem value="paid">Already paid</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            {advancePaymentStatus === "paid" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field id="advancePaymentAmount" label="Advance amount" error={errors.advancePaymentAmount?.message}>
                  <Input id="advancePaymentAmount" type="number" {...register("advancePaymentAmount")} />
                </Field>
                <Field id="advancePaymentMethod" label="Payment method" error={errors.advancePaymentMethod?.message}>
                  <Controller
                    control={control}
                    name="advancePaymentMethod"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="advancePaymentMethod" className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field id="advanceManualReference" label="Reference" error={errors.advanceManualReference?.message}>
                  <Input id="advanceManualReference" {...register("advanceManualReference")} />
                </Field>
                <Field id="advanceNotes" label="Advance notes" error={errors.advanceNotes?.message}>
                  <Input id="advanceNotes" {...register("advanceNotes")} />
                </Field>
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 border-t pt-4 md:grid-cols-[1fr_220px] md:items-start">
              <div className="text-sm">
                <p className="font-medium text-foreground">First month fee</p>
                <p className="mt-1 text-muted-foreground">
                  Use this when the first month hostel fee was received along with the advance.
                </p>
              </div>
              <Field id="firstMonthFeeStatus" label="Fee status" error={errors.firstMonthFeeStatus?.message}>
                <Controller
                  control={control}
                  name="firstMonthFeeStatus"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        if (value === "paid") {
                          setValue("firstMonthFeeAmount", currentMonthlyFee, {
                            shouldValidate: true,
                          })
                        }
                      }}
                    >
                      <SelectTrigger id="firstMonthFeeStatus" className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_paid">Not paid yet</SelectItem>
                        <SelectItem value="paid">Already paid</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            {firstMonthFeeStatus === "paid" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field id="firstMonthFeeAmount" label="First month fee amount" error={errors.firstMonthFeeAmount?.message}>
                  <Input id="firstMonthFeeAmount" type="number" {...register("firstMonthFeeAmount")} />
                </Field>
                <Field id="firstMonthFeeMethod" label="Payment method" error={errors.firstMonthFeeMethod?.message}>
                  <Controller
                    control={control}
                    name="firstMonthFeeMethod"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="firstMonthFeeMethod" className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field id="firstMonthFeeManualReference" label="Reference" error={errors.firstMonthFeeManualReference?.message}>
                  <Input id="firstMonthFeeManualReference" {...register("firstMonthFeeManualReference")} />
                </Field>
                <Field id="firstMonthFeeNotes" label="Fee notes" error={errors.firstMonthFeeNotes?.message}>
                  <Input id="firstMonthFeeNotes" {...register("firstMonthFeeNotes")} />
                </Field>
              </div>
            ) : null}
          </div>
        ) : null}
        {!resident && hostelModules.roomAllocation ? (
          <>
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground">Room assignment</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Save a preferred room for onboarding. When the resident completes their
                profile, the room is activated automatically if capacity is still available.
              </p>
            </div>
            <Field id="roomId" label="Preferred room" error={errors.roomId?.message}>
              <Controller
                control={control}
                name="roomId"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                    disabled={vacancyQuery.isLoading}
                  >
                    <SelectTrigger id="roomId" className="h-9 w-full">
                      <SelectValue
                        placeholder={
                          vacancyQuery.isLoading ? "Loading rooms" : "Choose preferred room"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Do not assign yet</SelectItem>
                      {availableRooms.map((room) => (
                        <SelectItem key={room.room_id} value={room.room_id}>
                          {room.room_number} · {room.available_beds} student vacancies
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="allocatedFrom" label="Allocated from" error={errors.allocatedFrom?.message}>
              <Input id="allocatedFrom" type="date" {...register("allocatedFrom")} />
            </Field>
          </>
        ) : null}
        {!isCreate ? (
          <Field id="permanentAddress" label="Permanent address" error={errors.permanentAddress?.message} className="md:col-span-2">
            <Textarea id="permanentAddress" className="min-h-24" {...register("permanentAddress")} />
          </Field>
        ) : null}
        {isCreate ? (
          <div className="md:col-span-2 rounded-lg border border-dashed bg-muted/30 p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_240px] md:items-start">
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  Resident access will be generated now
                </p>
                <p className="mt-1 text-muted-foreground">
                  Quick admission always creates draft resident access so onboarding cannot
                  deadlock. Share a WhatsApp activation link or a phone login temporary password.
                  Email can be added later during self-onboarding.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accessMode">Access mode</Label>
                <Select
                  value={accessMode}
                  onValueChange={(value) =>
                    setAccessMode(value as "activation_link" | "temporary_password")
                  }
                >
                  <SelectTrigger id="accessMode" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activation_link">WhatsApp activation link</SelectItem>
                    <SelectItem value="temporary_password">Phone + temporary password</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}
        <Field id="notes" label="Notes" error={errors.notes?.message} className="md:col-span-2">
          <Textarea id="notes" className="min-h-24" {...register("notes")} />
        </Field>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting || createResident.isPending || updateResident.isPending || createInvite.isPending}>
          {isSubmitting || createResident.isPending || updateResident.isPending || createInvite.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : isCreate ? (
            <UserPlus className="size-4" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {resident
            ? "Update Resident"
            : accessMode === "temporary_password"
              ? "Create & Issue Phone Login"
              : "Create & Generate Access"}
        </Button>
      </div>
    </form>
  )
}

function CreatedResidentAccessPanel({
  resident,
  invite,
  advancePayment,
  firstMonthFeePayment,
  invitePending,
}: {
  resident: Tables<"residents">
  invite: ResidentInviteCreated | null
  advancePayment: Tables<"payments"> | null
  firstMonthFeePayment: Tables<"payments"> | null
  invitePending: boolean
}) {
  return (
    <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">Draft resident created</p>
          <p className="mt-1 text-emerald-900">
            {resident.full_name} can now access their portal and complete profile,
            father phone, mother phone, address, and hostel rules from their phone.
          </p>
          <p className="mt-2 text-xs text-emerald-800">
            Admission: {resident.admission_number} · Status: draft
          </p>
          {advancePayment ? (
            <p className="mt-2 text-xs font-medium text-emerald-900">
              Advance captured: {formatCurrency(advancePayment.amount)} · {advancePayment.method}
            </p>
          ) : null}
          {firstMonthFeePayment ? (
            <p className="mt-1 text-xs font-medium text-emerald-900">
              First month fee captured: {formatCurrency(firstMonthFeePayment.amount)} ·{" "}
              {firstMonthFeePayment.method}
            </p>
          ) : null}
        </div>
        {invitePending ? (
          <div className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Preparing access
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {invite?.delivery.temporaryPassword ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              void copyToClipboard(invite.delivery.temporaryPassword ?? "", "Temporary password")
            }
          >
            <KeyRound className="size-4" aria-hidden="true" />
            Copy Temporary Password
          </Button>
        ) : null}
        {invite?.whatsappShareUrl ? (
          <Button asChild size="sm">
            <a href={invite.whatsappShareUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" aria-hidden="true" />
              Share on WhatsApp
            </a>
          </Button>
        ) : null}
        {invite?.activationLink ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copyToClipboard(invite.activationLink ?? "", "Activation link")}
          >
            <Copy className="size-4" aria-hidden="true" />
            Copy Link
          </Button>
        ) : null}
        {invite?.loginLink ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copyToClipboard(invite.loginLink, "Resident login link")}
          >
            <Copy className="size-4" aria-hidden="true" />
            Copy Login
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/residents/${resident.id}` as Route}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Open Resident
          </Link>
        </Button>
      </div>
    </div>
  )
}

function DuplicateResidentRecovery({
  details,
  organizationId,
  resendInvite,
  isResending,
}: {
  details: DuplicateResidentDetails
  organizationId: string | null
  resendInvite: () => Promise<void>
  isResending: boolean
}) {
  const resident = details.resident

  if (!resident?.id) {
    return null
  }

  return (
    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Resident already exists</p>
      <p className="mt-1 text-amber-900">
        We found {resident.fullName ?? "an existing resident"} with matching{" "}
        {details.matchedFields?.join(" and ") ?? "contact details"}. Continue the
        existing onboarding instead of creating another record.
      </p>
      <div className="mt-3 grid gap-1 text-xs text-amber-900 sm:grid-cols-2">
        <p>Admission: {resident.admissionNumber ?? "Not assigned"}</p>
        <p>Status: {resident.status ?? "draft"}</p>
        <p>Phone: {resident.phone ?? "Not saved"}</p>
        <p>Email: {resident.email ?? "Not saved"}</p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/residents/${resident.id}` as Route}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Continue Onboarding
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!organizationId || isResending || resident.hasPortalAccount}
          onClick={() => void resendInvite()}
        >
          {isResending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="size-4" aria-hidden="true" />
          )}
          Resend Activation
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={"/admin/residents" as Route}>Review Residents</Link>
        </Button>
      </div>
      {resident.hasPortalAccount ? (
        <p className="mt-3 text-xs text-amber-900">
          This resident already has portal access. Use password recovery or support
          instead of creating a new invite.
        </p>
      ) : null}
    </div>
  )
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`)
  }
}

function parseDuplicateDetails(details: unknown): DuplicateResidentDetails | null {
  if (!details || typeof details !== "object") {
    return null
  }

  const candidate = details as DuplicateResidentDetails

  if (
    candidate.type === "resident_duplicate" ||
    candidate.type === "resident_duplicate_constraint"
  ) {
    return candidate
  }

  return null
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className ? `grid gap-2 ${className}` : "grid gap-2"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
