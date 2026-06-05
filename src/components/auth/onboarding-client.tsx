"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, UserCheck } from "lucide-react"
import { useEffect, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { APIErrorState, EmptyState, GlobalLoader } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { trackResidentRegistration } from "@/lib/analytics/google-analytics"
import { FrontendApiError } from "@/lib/api-client"
import {
  useCurrentResident,
  useUpdateCurrentResident,
} from "@/hooks"

const onboardingSchema = z.object({
  preferredName: z.string().trim().max(80).optional(),
  phone: z.string().trim().min(8, "Phone number is required.").max(20),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  parentPhone: z.string().trim().min(8, "Father phone is required.").max(20),
  emergencyContactPhone: z.string().trim().min(8, "Mother phone is required.").max(20),
  permanentAddress: z.string().trim().max(500).optional(),
})

type OnboardingValues = z.infer<typeof onboardingSchema>

export function OnboardingClient() {
  const { session, organizationId, isLoading } = useAuth()
  const residentQuery = useCurrentResident(organizationId ?? undefined)
  const updateResident = useUpdateCurrentResident()
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      preferredName: "",
      phone: "",
      email: "",
      parentPhone: "",
      emergencyContactPhone: "",
      permanentAddress: "",
    },
  })

  const resident = residentQuery.data

  useEffect(() => {
    if (!resident) {
      return
    }

    reset({
      preferredName: resident.preferred_name ?? "",
      phone: resident.phone ?? "",
      email: resident.email ?? "",
      parentPhone: resident.parent_phone ?? "",
      emergencyContactPhone: resident.emergency_contact_phone ?? "",
      permanentAddress: resident.permanent_address ?? "",
    })
  }, [reset, resident])

  if (isLoading) {
    return <GlobalLoader label="Loading onboarding..." />
  }

  if (!session?.authenticated) {
    return (
      <EmptyState
        title="Sign in required"
        message="Please sign in before completing onboarding."
      />
    )
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Waiting for organization access"
        message="Your account has been created, but an admin still needs to assign it to Sadhana Boys Hostel."
      />
    )
  }

  if (residentQuery.isLoading) {
    return <GlobalLoader label="Loading resident profile..." />
  }

  if (residentQuery.error || !resident) {
    return (
      <APIErrorState
        title="Resident profile not linked"
        message="Ask an admin to link your login account with your resident record."
        onRetry={() => void residentQuery.refetch()}
      />
    )
  }

  async function onSubmit(values: OnboardingValues) {
    if (!organizationId) {
      return
    }

    try {
      await updateResident.mutateAsync({
        organizationId,
        preferredName: values.preferredName || undefined,
        phone: values.phone,
        email: values.email || undefined,
        parentPhone: values.parentPhone || undefined,
        emergencyContactPhone: values.emergencyContactPhone || undefined,
        permanentAddress: values.permanentAddress || undefined,
      })
      trackResidentRegistration({
        source: "auth_onboarding",
        status: "details_saved",
      })
      toast.success("Onboarding details saved.")
    } catch (error) {
      setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to save onboarding details.",
      })
    }
  }

  return (
    <div className="grid gap-6">
      {errors.root?.message ? (
        <APIErrorState title="Could not save" message={errors.root.message} />
      ) : null}

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <UserCheck className="mt-1 size-5 text-emerald-600" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold">{resident.full_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admission {resident.admission_number} · Room assignment and fees are controlled by
              hostel admins.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred name" id="preferredName" error={errors.preferredName?.message}>
            <Input id="preferredName" {...register("preferredName")} />
          </Field>
          <Field label="Phone" id="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
          </Field>
          <Field label="Email (optional)" id="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field label="Father phone" id="parentPhone" error={errors.parentPhone?.message}>
            <Input id="parentPhone" type="tel" {...register("parentPhone")} />
          </Field>
          <Field
            label="Mother phone"
            id="emergencyContactPhone"
            error={errors.emergencyContactPhone?.message}
          >
            <Input id="emergencyContactPhone" type="tel" {...register("emergencyContactPhone")} />
          </Field>
          <Field
            label="Permanent address"
            id="permanentAddress"
            error={errors.permanentAddress?.message}
            className="sm:col-span-2"
          >
            <Textarea id="permanentAddress" className="min-h-24" {...register("permanentAddress")} />
          </Field>
        </div>

        <Button type="submit" className="h-10" disabled={isSubmitting || updateResident.isPending}>
          {isSubmitting || updateResident.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserCheck className="size-4" aria-hidden="true" />
          )}
          Save onboarding details
        </Button>
      </form>

    </div>
  )
}

function Field({
  label,
  id,
  error,
  className,
  children,
}: {
  label: string
  id: string
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
