"use client"

import { useEffect, useState } from "react"
import type { Route } from "next"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
  UserRound,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { trackResidentRegistration } from "@/lib/analytics/google-analytics"
import { FrontendApiError } from "@/lib/api-client"
import { HOSTEL_RULES, HOSTEL_RULES_VERSION } from "@/constants/hostel"
import {
  useResidentOnboarding,
  useSubmitResidentOnboarding,
  useUpdateResidentOnboardingProfile,
} from "@/hooks"
import {
  onboardingProfileFormSchema,
  type OnboardingProfileInput,
} from "@/validations/onboarding.validation"

const formSchema = onboardingProfileFormSchema
type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

const missingLabels: Record<string, string> = {
  full_name: "Full name",
  date_of_birth: "Date of birth",
  phone: "Phone",
  father_phone: "Father phone",
  mother_phone: "Mother phone",
  permanent_address: "Permanent address",
  rules_acceptance: "Hostel rules acceptance",
}

export function ResidentOnboardingClient() {
  const { organizationId } = useAuth()
  const onboarding = useResidentOnboarding(organizationId)
  const updateProfile = useUpdateResidentOnboardingProfile()
  const submitOnboarding = useSubmitResidentOnboarding()
  const [rulesAcceptedOverride, setRulesAcceptedOverride] = useState(false)

  const resident = onboarding.data?.resident
  const requirements = onboarding.data?.requirements
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      preferredName: "",
      gender: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      parentPhone: "",
      emergencyContactPhone: "",
      permanentAddress: "",
      collegeName: "",
      courseName: "",
    },
  })

  useEffect(() => {
    if (!resident) {
      return
    }

    const onboardingMeta =
      resident.metadata &&
      typeof resident.metadata === "object" &&
      !Array.isArray(resident.metadata)
        ? (resident.metadata.onboarding as Record<string, unknown> | undefined)
        : undefined

    form.reset({
      fullName: resident.full_name ?? "",
      preferredName: resident.preferred_name ?? "",
      gender: resident.gender ?? "",
      dateOfBirth: resident.date_of_birth ?? "",
      phone: resident.phone ?? "",
      email: resident.email ?? "",
      parentPhone: resident.parent_phone ?? "",
      emergencyContactPhone: resident.emergency_contact_phone ?? "",
      permanentAddress: resident.permanent_address ?? "",
      collegeName: String(onboardingMeta?.collegeName ?? ""),
      courseName: String(onboardingMeta?.courseName ?? ""),
    })
  }, [form, resident])

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization assignment pending"
        message="Ask the hostel admin to finish linking your account before onboarding."
      />
    )
  }

  if (onboarding.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (onboarding.isError || !resident || !requirements) {
    return (
      <APIErrorState
        title="Onboarding could not be loaded"
        error={onboarding.error}
        onRetry={() => void onboarding.refetch()}
      />
    )
  }

  const onboardingComplete = requirements.canAccessResidentOperations
  const rulesAccepted =
    rulesAcceptedOverride || hasAcceptedCurrentHostelRules(resident)
  const effectiveMissing = requirements.missing.filter(
    (item) => item !== "rules_acceptance" || !rulesAccepted
  )
  const canFinishOnboarding = effectiveMissing.length === 0

  async function saveProfile(values: FormValues) {
    if (!organizationId) {
      return
    }

    try {
      await updateProfile.mutateAsync({
        organizationId,
        ...values,
      } satisfies OnboardingProfileInput)
      await onboarding.refetch()
      toast.success("Onboarding profile saved.")
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to save onboarding profile. Please retry.",
      })
    }
  }

  async function submitForVerification() {
    if (!organizationId) {
      return
    }

    if (!rulesAccepted) {
      form.setError("root", {
        message: "Accept hostel rules and regulations before continuing.",
      })
      return
    }

    try {
      await submitOnboarding.mutateAsync({ organizationId, rulesAccepted: true })
      trackResidentRegistration({
        source: "resident_onboarding",
        status: "completed",
      })
      await onboarding.refetch()
      toast.success("Onboarding complete. Your dashboard is ready.")
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to complete onboarding. Please retry.",
      })
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="gap-4 lg:grid lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <CardTitle>Resident Onboarding</CardTitle>
            <CardDescription>
              Complete your profile and accept hostel rules. Payments can be submitted
              now; leave, notices, invoices, and dashboard actions unlock when everything
              is complete.
            </CardDescription>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <p className="font-medium">{requirements.completionPercent}% complete</p>
            <div className="mt-2 h-2 w-44 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-600"
                style={{ width: `${requirements.completionPercent}%` }}
              />
            </div>
            <div className="mt-3">
              <StatusBadge status={requirements.status} />
            </div>
          </div>
        </CardHeader>
        {requirements.status === "rejected" ? (
          <CardContent>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mb-2 size-4" aria-hidden="true" />
              {resident.onboarding_rejection_reason ||
                "Your onboarding was rejected. Update the requested details and submit again."}
              <div className="mt-3">
                <Button asChild variant="outline" size="sm">
                  <Link href={"/resident/support?category=onboarding" as Route}>
                    Get onboarding help
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5" aria-hidden="true" />
              Profile Details
            </CardTitle>
            <CardDescription>
              Use accurate details for hostel records and family contact.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {form.formState.errors.root?.message ? (
              <div className="mb-5">
                <APIErrorState
                  title="Onboarding action failed"
                  message={form.formState.errors.root.message}
                />
              </div>
            ) : null}
            <form className="grid gap-5" onSubmit={form.handleSubmit(saveProfile)}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field form={form} name="fullName" label="Full name" />
                <Field form={form} name="preferredName" label="Preferred name" />
                <Field form={form} name="dateOfBirth" label="Date of birth" type="date" />
                <Field form={form} name="gender" label="Gender" />
                <Field form={form} name="phone" label="Phone" type="tel" />
                <Field form={form} name="email" label="Email (optional)" type="email" />
                <Field form={form} name="parentPhone" label="Father phone" type="tel" />
                <Field form={form} name="emergencyContactPhone" label="Mother phone" type="tel" />
                <Field form={form} name="collegeName" label="College / employer" />
                <Field form={form} name="courseName" label="Course / department" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="permanentAddress">Permanent address</Label>
                <Textarea id="permanentAddress" {...form.register("permanentAddress")} />
                {form.formState.errors.permanentAddress ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.permanentAddress.message}
                  </p>
                ) : null}
              </div>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rules and Regulations</CardTitle>
              <CardDescription>
                Read and accept these hostel rules before continuing.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ol className="grid gap-3 text-sm leading-6 text-muted-foreground">
                {HOSTEL_RULES.map((rule, index) => (
                  <li key={rule} className="grid grid-cols-[1.75rem_1fr] gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{rule}</span>
                  </li>
                ))}
              </ol>
              <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  checked={rulesAccepted}
                  disabled={onboardingComplete}
                  onChange={(event) => setRulesAcceptedOverride(event.target.checked)}
                />
                <span>
                  I have read and accept the hostel rules and regulations, including the
                  no-refund rule after joining.
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Rules version {HOSTEL_RULES_VERSION}. Acceptance is saved with your onboarding
                record.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Missing Items</CardTitle>
              <CardDescription>Complete these to activate your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              {effectiveMissing.length === 0 ? (
                <div className="rounded-lg border bg-emerald-50 p-3 text-sm text-emerald-700">
                  All requirements are complete.
                </div>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {effectiveMissing.map((item) => (
                    <li key={item} className="rounded-lg border p-2">
                      {missingLabels[item] ?? item}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                className="mt-4 w-full gap-2"
                disabled={
                  onboardingComplete ||
                  !canFinishOnboarding ||
                  submitOnboarding.isPending
                }
                onClick={() => void submitForVerification()}
              >
                {submitOnboarding.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                {onboardingComplete ? "Onboarding complete" : "Finish onboarding"}
              </Button>
              {requirements.canAccessResidentOperations ? (
                <Button asChild variant="outline" className="mt-2 w-full">
                  <Link href={"/resident/dashboard" as Route}>Go to dashboard</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({
  form,
  name,
  label,
  type = "text",
  inputMode,
}: {
  form: ReturnType<typeof useForm<FormInput, unknown, FormValues>>
  name: keyof FormInput
  label: string
  type?: string
  inputMode?: "numeric"
}) {
  const error = form.formState.errors[name]?.message

  return (
    <div className="grid gap-2">
      <Label htmlFor={String(name)}>{label}</Label>
      <Input
        id={String(name)}
        type={type}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        {...form.register(name)}
      />
      {error ? <p className="text-xs text-destructive">{String(error)}</p> : null}
    </div>
  )
}

function hasAcceptedCurrentHostelRules(resident: NonNullable<ReturnType<typeof useResidentOnboarding>["data"]>["resident"]) {
  if (
    resident.onboarding_status === "verified" &&
    resident.status === "active" &&
    resident.is_active !== false
  ) {
    return true
  }

  const metadata = objectFromUnknown(resident.metadata)
  const onboarding = objectFromUnknown(metadata.onboarding)
  const acceptance = objectFromUnknown(onboarding.hostelRulesAcceptance)

  return (
    acceptance.accepted === true &&
    acceptance.version === HOSTEL_RULES_VERSION &&
    typeof acceptance.acceptedAt === "string"
  )
}

function objectFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
