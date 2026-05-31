"use client"

import { useMemo, useState } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  BadgeCheck,
  BedDouble,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { APIErrorState } from "@/components/system/api-error-state"
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
import { HOSTEL_TOTAL_CAPACITY } from "@/constants/hostel"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { useBootstrapAdminTenant, useSetupStatus } from "@/hooks"
import {
  bootstrapAdminTenantSchema,
  type BootstrapAdminTenantInput,
} from "@/validations/platform.validation"

const steps = [
  { title: "Organization", icon: Building2 },
  { title: "Hostel", icon: BedDouble },
  { title: "Branding", icon: Palette },
  { title: "Capacity", icon: ShieldCheck },
  { title: "Payment", icon: CreditCard },
  { title: "Confirm", icon: BadgeCheck },
] as const

type SetupFormValues = z.input<typeof bootstrapAdminTenantSchema>

export function AdminSetupWizardClient() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [stepIndex, setStepIndex] = useState(0)
  const setupQuery = useSetupStatus()
  const bootstrap = useBootstrapAdminTenant()
  const form = useForm<SetupFormValues>({
    resolver: zodResolver(bootstrapAdminTenantSchema),
    defaultValues: {
      organizationName: "Sadhana Boys Hostel",
      organizationPhone: "",
      organizationEmail: "",
      organizationAddress: "",
      organizationCity: "",
      organizationState: "",
      hostelName: "Sadhana Boys Hostel",
      hostelPhone: "",
      hostelEmail: "",
      hostelAddress: "",
      hostelCity: "",
      hostelState: "",
      hostelCapacity: HOSTEL_TOTAL_CAPACITY,
      upiId: "",
      paymentAccountName: "Sadhana Boys Hostel",
      paymentInstructions:
        "Scan the hostel QR or pay to the UPI ID, then upload UTR and screenshot for verification.",
    },
  })

  const setupStatus = setupQuery.data
  const isComplete = setupStatus && !setupStatus.setupRequired
  const currentStep = steps[stepIndex]
  const StepIcon = currentStep.icon
  const watchedValues = useWatch({ control: form.control })
  const completionSummary = useMemo(
    () => [
      { label: "Organization", value: watchedValues.organizationName || "Not set" },
      { label: "Hostel", value: watchedValues.hostelName || watchedValues.organizationName || "Not set" },
      {
        label: "Capacity",
        value: `${watchedValues.hostelCapacity || HOSTEL_TOTAL_CAPACITY} students`,
      },
      { label: "UPI", value: watchedValues.upiId || "Configure later" },
    ],
    [watchedValues]
  )

  async function handleNext() {
    const fieldsByStep: Array<Array<keyof SetupFormValues>> = [
      ["organizationName", "organizationPhone", "organizationEmail"],
      ["hostelName", "hostelPhone", "hostelEmail"],
      ["organizationAddress", "organizationCity", "organizationState"],
      ["hostelCapacity"],
      ["upiId", "paymentAccountName", "paymentInstructions"],
      [],
    ]
    const isValid = await form.trigger(fieldsByStep[stepIndex])

    if (isValid) {
      setStepIndex((index) => Math.min(index + 1, steps.length - 1))
    }
  }

  async function onSubmit(values: SetupFormValues) {
    try {
      const parsedValues = bootstrapAdminTenantSchema.parse(values)

      await bootstrap.mutateAsync(parsedValues as BootstrapAdminTenantInput)
      await refreshSession()
      toast.success("Admin workspace created. You can manage the hostel from here now.")
      router.replace("/admin/dashboard" as Route)
      router.refresh()
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Admin workspace setup could not be completed. Please retry.",
      })
    }
  }

  if (setupQuery.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Checking admin workspace setup...
        </div>
      </div>
    )
  }

  if (setupQuery.isError) {
    return (
      <APIErrorState
        title="Setup status could not be loaded"
        error={setupQuery.error}
        onRetry={() => void setupQuery.refetch()}
      />
    )
  }

  if (isComplete) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>Workspace setup is complete</CardTitle>
          <CardDescription>
            Your organization and active hostel are configured. Continue to the dashboard
            or open Settings to manage hostels, branding, and operating details.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => router.push("/admin/dashboard" as Route)}>
            Open dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/admin/settings" as Route)}
          >
            Manage settings
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <Sparkles className="size-3.5" aria-hidden="true" />
              First-run admin setup
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">
              Create your hostel operations workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This guided setup creates the organization, first hostel, capacity
              record, CMS placeholders, facilities, and optional UPI receiving
              configuration without opening Supabase.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === stepIndex
              const isDone = index < stepIndex

              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={
                    "grid place-items-center gap-1 rounded-lg border px-2 py-2 text-xs transition " +
                    (isActive
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "bg-white text-muted-foreground")
                  }
                  aria-current={isActive ? "step" : undefined}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{step.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                <StepIcon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>{currentStep.title}</CardTitle>
                <CardDescription>{getStepDescription(stepIndex)}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {form.formState.errors.root?.message ? (
              <div className="mb-5">
                <APIErrorState
                  title="Setup failed"
                  message={form.formState.errors.root.message}
                />
              </div>
            ) : null}
            {renderStep(stepIndex, form)}
          </CardContent>
        </Card>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Setup Summary</CardTitle>
              <CardDescription>Review what will be created.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {completionSummary.map((item) => (
                <div key={item.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 rounded-lg border bg-white p-3">
            <Button
              type={stepIndex === steps.length - 1 ? "submit" : "button"}
              onClick={stepIndex === steps.length - 1 ? undefined : handleNext}
              disabled={bootstrap.isPending}
              className="gap-2"
            >
              {bootstrap.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {stepIndex === steps.length - 1 ? "Create workspace" : "Continue"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={stepIndex === 0 || bootstrap.isPending}
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            >
              Back
            </Button>
          </div>
        </aside>
      </form>
    </div>
  )
}

function getStepDescription(stepIndex: number) {
  return [
    "Set the legal operating identity and primary contact details.",
    "Create the first active hostel branch for daily operations.",
    "Add address and brand-facing details used across admin and website setup.",
    "Confirm live capacity so vacancy, reservations, and analytics work correctly.",
    "Optionally configure UPI receiving details. You can rotate QR later.",
    "Check everything before the platform creates records and role scope.",
  ][stepIndex]
}

function renderStep(
  stepIndex: number,
  form: ReturnType<typeof useForm<SetupFormValues>>
) {
  switch (stepIndex) {
    case 0:
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field form={form} name="organizationName" label="Organization name" />
          <Field form={form} name="organizationPhone" label="Primary phone" />
          <Field form={form} name="organizationEmail" label="Billing email" />
        </div>
      )
    case 1:
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field form={form} name="hostelName" label="Hostel name" />
          <Field form={form} name="hostelPhone" label="Hostel phone" />
          <Field form={form} name="hostelEmail" label="Hostel email" />
        </div>
      )
    case 2:
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field form={form} name="organizationAddress" label="Organization address" className="md:col-span-2" />
          <Field form={form} name="organizationCity" label="City" />
          <Field form={form} name="organizationState" label="State" />
          <Field form={form} name="hostelAddress" label="Hostel address" className="md:col-span-2" />
        </div>
      )
    case 3:
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field form={form} name="hostelCapacity" label="Total hostel capacity" type="number" />
          <div className="rounded-lg border bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
            Capacity drives public vacancy, reservation checks, room allocation
            safety, and dashboard occupancy. The default is 70 students for this hostel.
          </div>
        </div>
      )
    case 4:
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field form={form} name="upiId" label="UPI ID" placeholder="sadhanahostel@ibl" />
          <Field form={form} name="paymentAccountName" label="Account holder name" />
          <TextField form={form} name="paymentInstructions" label="Payment instructions" className="md:col-span-2" />
        </div>
      )
    default:
      return (
        <div className="rounded-lg border bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
          The setup wizard will create the tenant, first hostel, capacity snapshot,
          CMS starter content, default facilities, and role scope for this admin.
        </div>
      )
  }
}

function Field({
  form,
  name,
  label,
  className,
  type = "text",
  placeholder,
}: {
  form: ReturnType<typeof useForm<SetupFormValues>>
  name: keyof SetupFormValues
  label: string
  className?: string
  type?: string
  placeholder?: string
}) {
  const error = form.formState.errors[name]?.message

  return (
    <div className={className}>
      <Label htmlFor={String(name)}>{label}</Label>
      <Input
        id={String(name)}
        type={type}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        {...form.register(name)}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{String(error)}</p> : null}
    </div>
  )
}

function TextField({
  form,
  name,
  label,
  className,
}: {
  form: ReturnType<typeof useForm<SetupFormValues>>
  name: keyof SetupFormValues
  label: string
  className?: string
}) {
  const error = form.formState.errors[name]?.message

  return (
    <div className={className}>
      <Label htmlFor={String(name)}>{label}</Label>
      <Textarea id={String(name)} aria-invalid={Boolean(error)} {...form.register(name)} />
      {error ? <p className="mt-1 text-xs text-destructive">{String(error)}</p> : null}
    </div>
  )
}
