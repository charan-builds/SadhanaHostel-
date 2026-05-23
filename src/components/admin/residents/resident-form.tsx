"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import type { ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
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
import { HOSTEL_FEES } from "@/constants/hostel"
import { useAuth } from "@/lib/auth"
import { FrontendApiError } from "@/lib/api-client"
import { useAdmissionsVacancy, useCreateResident, useUpdateResident } from "@/hooks"
import type { Tables } from "@/types/database"

const residentFormSchema = z.object({
  admissionNumber: z.string().trim().min(1, "Admission number is required."),
  fullName: z.string().trim().min(2, "Full name is required."),
  preferredName: z.string().trim().max(80).optional(),
  residentType: z.enum(["student", "employee", "other"]),
  gender: z.string().trim().max(40).optional(),
  dateOfBirth: z.string().optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  parentName: z.string().trim().max(120).optional(),
  parentPhone: z.string().trim().max(20).optional(),
  parentEmail: z.string().trim().email("Enter a valid parent email.").optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(20).optional(),
  permanentAddress: z.string().trim().max(500).optional(),
  monthlyFeeAmount: z.coerce.number().nonnegative(),
  securityDepositAmount: z.coerce.number().nonnegative(),
  roomId: z.string().uuid("Choose an available room.").optional().or(z.literal("")),
  bedLabel: z.string().trim().max(40).optional(),
  allocatedFrom: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["draft", "active", "suspended", "checked_out", "archived"]).optional(),
})

type ResidentFormInput = z.input<typeof residentFormSchema>
type ResidentFormValues = z.output<typeof residentFormSchema>

type ResidentFormProps = {
  resident?: Tables<"residents">
  onSaved?: (resident: Tables<"residents">) => void
  onCancel?: () => void
}

export function ResidentForm({ resident, onSaved, onCancel }: ResidentFormProps) {
  const { organizationId, session } = useAuth()
  const hostelId = resident?.hostel_id ?? session?.hostelIds[0] ?? null
  const createResident = useCreateResident()
  const updateResident = useUpdateResident()
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
      parentName: resident?.parent_name ?? "",
      parentPhone: resident?.parent_phone ?? "",
      parentEmail: resident?.parent_email ?? "",
      emergencyContactName: resident?.emergency_contact_name ?? "",
      emergencyContactPhone: resident?.emergency_contact_phone ?? "",
      permanentAddress: resident?.permanent_address ?? "",
      monthlyFeeAmount: resident?.monthly_fee_amount ?? HOSTEL_FEES.student,
      securityDepositAmount: resident?.security_deposit_amount ?? 0,
      roomId: "",
      bedLabel: "",
      allocatedFrom: new Date().toISOString().slice(0, 10),
      notes: resident?.notes ?? "",
      status: resident?.status ?? "active",
    },
  })

  async function onSubmit(values: ResidentFormValues) {
    if (!organizationId || !hostelId) {
      setError("root", {
        message: "Your admin account is not assigned to an organization and hostel.",
      })
      return
    }

    try {
      const savedResident = resident
        ? await updateResident.mutateAsync({
            residentId: resident.id,
            organizationId,
            fullName: values.fullName,
            preferredName: values.preferredName || undefined,
            residentType: values.residentType,
            gender: values.gender || undefined,
            dateOfBirth: values.dateOfBirth || undefined,
            phone: values.phone || undefined,
            email: values.email || undefined,
            parentName: values.parentName || undefined,
            parentPhone: values.parentPhone || undefined,
            parentEmail: values.parentEmail || undefined,
            emergencyContactName: values.emergencyContactName || undefined,
            emergencyContactPhone: values.emergencyContactPhone || undefined,
            permanentAddress: values.permanentAddress || undefined,
            monthlyFeeAmount: values.monthlyFeeAmount,
            securityDepositAmount: values.securityDepositAmount,
            notes: values.notes || undefined,
            status: values.status,
          })
        : await createResident.mutateAsync({
            organizationId,
            hostelId,
            admissionNumber: values.admissionNumber,
            fullName: values.fullName,
            preferredName: values.preferredName || undefined,
            residentType: values.residentType,
            gender: values.gender || undefined,
            dateOfBirth: values.dateOfBirth || undefined,
            phone: values.phone || undefined,
            email: values.email || undefined,
            parentName: values.parentName || undefined,
            parentPhone: values.parentPhone || undefined,
            parentEmail: values.parentEmail || undefined,
            emergencyContactName: values.emergencyContactName || undefined,
            emergencyContactPhone: values.emergencyContactPhone || undefined,
            permanentAddress: values.permanentAddress || undefined,
            monthlyFeeAmount: values.monthlyFeeAmount,
            securityDepositAmount: values.securityDepositAmount,
            roomId: values.roomId || undefined,
            bedLabel: values.bedLabel || undefined,
            allocatedFrom: values.allocatedFrom || undefined,
            notes: values.notes || undefined,
          })

      toast.success(resident ? "Resident updated." : "Resident created.")
      onSaved?.(savedResident)
    } catch (error) {
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
        <h2 className="text-lg font-semibold text-foreground">Resident Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create or update resident profile data through the production API.
        </p>
      </div>

      {errors.root?.message ? (
        <div className="mt-5">
          <APIErrorState title="Could not save resident" message={errors.root.message} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field id="admissionNumber" label="Admission number" error={errors.admissionNumber?.message}>
          <Input
            id="admissionNumber"
            disabled={Boolean(resident)}
            {...register("admissionNumber")}
          />
        </Field>
        <Field id="fullName" label="Full name" error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" {...register("fullName")} />
        </Field>
        <Field id="preferredName" label="Preferred name" error={errors.preferredName?.message}>
          <Input id="preferredName" {...register("preferredName")} />
        </Field>
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
                    setValue(
                      "monthlyFeeAmount",
                      value === "employee" ? HOSTEL_FEES.employee : HOSTEL_FEES.student,
                      { shouldValidate: true }
                    )
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
        <Field id="phone" label="Phone" error={errors.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
        </Field>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field id="parentName" label="Parent name" error={errors.parentName?.message}>
          <Input id="parentName" {...register("parentName")} />
        </Field>
        <Field id="parentPhone" label="Parent phone" error={errors.parentPhone?.message}>
          <Input id="parentPhone" type="tel" {...register("parentPhone")} />
        </Field>
        <Field id="emergencyContactName" label="Emergency contact name" error={errors.emergencyContactName?.message}>
          <Input id="emergencyContactName" {...register("emergencyContactName")} />
        </Field>
        <Field id="emergencyContactPhone" label="Emergency contact phone" error={errors.emergencyContactPhone?.message}>
          <Input id="emergencyContactPhone" type="tel" {...register("emergencyContactPhone")} />
        </Field>
        <Field id="monthlyFeeAmount" label="Monthly fee" error={errors.monthlyFeeAmount?.message}>
          <Input id="monthlyFeeAmount" type="number" {...register("monthlyFeeAmount")} />
        </Field>
        <Field id="securityDepositAmount" label="Security deposit" error={errors.securityDepositAmount?.message}>
          <Input id="securityDepositAmount" type="number" {...register("securityDepositAmount")} />
        </Field>
        {!resident ? (
          <>
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground">Room assignment</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Assign a room now to update live occupancy and vacancy immediately. Leave blank only for draft pre-onboarding residents.
              </p>
            </div>
            <Field id="roomId" label="Available room" error={errors.roomId?.message}>
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
                          vacancyQuery.isLoading ? "Loading rooms" : "Choose room"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Do not assign yet</SelectItem>
                      {availableRooms.map((room) => (
                        <SelectItem key={room.room_id} value={room.room_id}>
                          {room.room_number} · {room.available_beds} beds available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="bedLabel" label="Bed label" error={errors.bedLabel?.message}>
              <Input id="bedLabel" placeholder="A, B, 1, 2" {...register("bedLabel")} />
            </Field>
            <Field id="allocatedFrom" label="Allocated from" error={errors.allocatedFrom?.message}>
              <Input id="allocatedFrom" type="date" {...register("allocatedFrom")} />
            </Field>
          </>
        ) : null}
        <Field id="permanentAddress" label="Permanent address" error={errors.permanentAddress?.message} className="md:col-span-2">
          <Textarea id="permanentAddress" className="min-h-24" {...register("permanentAddress")} />
        </Field>
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
        <Button type="submit" disabled={isSubmitting || createResident.isPending || updateResident.isPending}>
          {isSubmitting || createResident.isPending || updateResident.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {resident ? "Update Resident" : "Save Resident"}
        </Button>
      </div>
    </form>
  )
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
