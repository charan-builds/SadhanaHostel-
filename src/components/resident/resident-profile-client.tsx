"use client"

import { useEffect, useMemo, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, type Variants } from "framer-motion"
import {
  CalendarDays,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import { useForm, type UseFormRegisterReturn } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
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
import { FrontendApiError } from "@/lib/api-client"
import { formatDate, humanizeEnum } from "@/lib/format"
import {
  useCurrentResident,
  useUpdateCurrentResident,
} from "@/hooks"
import { updateOwnResidentProfileSchema } from "@/validations/resident.validation"

const profileFormSchema = updateOwnResidentProfileSchema.omit({
  organizationId: true,
})

type ProfileFormInput = z.input<typeof profileFormSchema>
type ProfileFormValues = z.output<typeof profileFormSchema>

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const reveal: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  },
}

export function ResidentProfileClient() {
  const { organizationId } = useAuth()
  const residentQuery = useCurrentResident(organizationId ?? undefined)
  const updateProfile = useUpdateCurrentResident()

  const resident = residentQuery.data ?? null

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      preferredName: "",
      phone: "",
      email: "",
      parentPhone: "",
      emergencyContactPhone: "",
      permanentAddress: "",
    },
  })

  useEffect(() => {
    if (!resident) {
      return
    }

    form.reset({
      preferredName: resident.preferred_name ?? "",
      phone: resident.phone ?? "",
      email: resident.email ?? "",
      parentPhone: resident.parent_phone ?? "",
      emergencyContactPhone: resident.emergency_contact_phone ?? "",
      permanentAddress: resident.permanent_address ?? "",
    })
  }, [form, resident])

  const completion = useMemo(() => {
    if (!resident) {
      return 0
    }

    const requiredFields = [
      resident.phone,
      resident.parent_phone,
      resident.emergency_contact_phone,
      resident.permanent_address,
    ]

    const completed = requiredFields.filter(Boolean).length

    return Math.round((completed / requiredFields.length) * 100)
  }, [resident])

  async function onSubmit(values: ProfileFormValues) {
    if (!organizationId) {
      toast.error("Your account is not linked to an organization yet.")
      return
    }

    try {
      await updateProfile.mutateAsync({
        organizationId,
        ...values,
      })
      toast.success("Profile updated.")
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to update profile. Please retry.",
      })
    }
  }

  if (residentQuery.isLoading) {
    return <ProfileSkeleton />
  }

  if (residentQuery.isError) {
    return (
      <APIErrorState
        title="Profile could not be loaded"
        error={residentQuery.error}
        onRetry={() => void residentQuery.refetch()}
      />
    )
  }

  if (!resident) {
    return (
      <EmptyState
        title="Resident profile not linked"
        message="Ask the hostel admin to link your login account to your resident record."
      />
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-6">
      <ProfileHero
        fullName={resident.full_name}
        preferredName={resident.preferred_name}
        admissionNumber={resident.admission_number}
        status={resident.status}
        residentType={humanizeEnum(resident.resident_type)}
        completion={completion}
      />

      <motion.section variants={reveal} className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={CalendarDays}
          title="Admission information"
          items={[
            ["Admission no.", resident.admission_number],
            ["Joined", resident.joined_on ? formatDate(resident.joined_on) : "Pending"],
            ["Resident type", humanizeEnum(resident.resident_type)],
            ["Status", <StatusBadge key="status" status={resident.status} />],
          ]}
        />
        <InfoCard
          icon={ShieldCheck}
          title="Fee information"
          items={[
            ["Monthly fee", `₹${Number(resident.monthly_fee_amount).toLocaleString("en-IN")}`],
            ["Security deposit", `₹${Number(resident.security_deposit_amount).toLocaleString("en-IN")}`],
            ["Hostel record", resident.hostel_id.slice(0, 8)],
          ]}
        />
        <InfoCard
          icon={ShieldCheck}
          title="Family contacts"
          items={[
            ["Father phone", resident.parent_phone ?? "Not added"],
            ["Mother phone", resident.emergency_contact_phone ?? "Not added"],
          ]}
        />
      </motion.section>

      <div className="grid gap-6">
        <motion.div variants={reveal}>
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-white/45">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Profile details</CardTitle>
                  <CardDescription>
                    Keep your contact and family phone numbers current.
                  </CardDescription>
                </div>
                <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/15 sm:inline-flex">
                  Editable
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
            {form.formState.errors.root?.message ? (
              <div className="mb-5">
                <APIErrorState
                  title="Profile update failed"
                  message={form.formState.errors.root.message}
                />
              </div>
            ) : null}
            <motion.form
              layout
              className="grid gap-6"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <FormSection
                icon={UserRoundCheck}
                title="Student identity"
                description="Your core resident identity is managed by hostel administration."
              >
                <ReadOnlyField label="Full name" value={resident.full_name} />
                <ReadOnlyField label="Resident type" value={humanizeEnum(resident.resident_type)} />
                <Field
                  id="preferredName"
                  label="Preferred name"
                  registration={form.register("preferredName")}
                  error={form.formState.errors.preferredName?.message}
                />
                <Field
                  id="phone"
                  label="Phone"
                  type="tel"
                  registration={form.register("phone")}
                  error={form.formState.errors.phone?.message}
                />
                <Field
                  id="email"
                  label="Email (optional)"
                  type="email"
                  registration={form.register("email")}
                  error={form.formState.errors.email?.message}
                />
                <ReadOnlyField
                  label="Monthly fee"
                  value={`₹${Number(resident.monthly_fee_amount).toLocaleString("en-IN")}`}
                />
              </FormSection>

              <FormSection
                icon={UsersRound}
                title="Family phone numbers"
                description="These numbers help the hostel team reach your family quickly."
              >
                <Field
                  id="parentPhone"
                  label="Father phone"
                  type="tel"
                  registration={form.register("parentPhone")}
                  error={form.formState.errors.parentPhone?.message}
                />
                <Field
                  id="emergencyContactPhone"
                  label="Mother phone"
                  type="tel"
                  registration={form.register("emergencyContactPhone")}
                  error={form.formState.errors.emergencyContactPhone?.message}
                />
              </FormSection>

              <FormSection
                icon={MapPin}
                title="Permanent address"
                description="Used for hostel records and emergency reference."
                columns="single"
              >
                <div className="grid gap-2">
                  <Label htmlFor="permanentAddress">Permanent address</Label>
                  <Textarea
                    id="permanentAddress"
                    rows={4}
                    {...form.register("permanentAddress")}
                  />
                  {form.formState.errors.permanentAddress?.message ? (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.permanentAddress.message}
                    </p>
                  ) : null}
                </div>
              </FormSection>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="gap-2"
                >
                  {updateProfile.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Save profile
                </Button>
              </div>
            </motion.form>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </motion.div>
  )
}

function ProfileHero({
  fullName,
  preferredName,
  admissionNumber,
  status,
  residentType,
  completion,
}: {
  fullName: string
  preferredName?: string | null
  admissionNumber: string
  status: string
  residentType: string
  completion: number
}) {
  const displayName = preferredName || fullName

  return (
    <motion.section variants={reveal} className="overflow-hidden rounded-2xl border bg-slate-950 text-white shadow-lifted">
      <div className="relative p-5 sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_32rem),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.22),transparent_26rem)]" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-2xl">
              <div className="grid h-full w-full place-items-center text-3xl font-semibold">
                {getInitials(displayName)}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-cyan-100">Resident profile</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {displayName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/72">
                <span>{admissionNumber}</span>
                <span aria-hidden="true">·</span>
                <span>{residentType}</span>
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl sm:min-w-64">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/64">Completion</span>
              <span className="text-2xl font-semibold">{completion}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className="h-full rounded-full bg-cyan-200"
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

function InfoCard({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon
  title: string
  items: [string, ReactNode][]
}) {
  return (
    <motion.article variants={reveal} className="saas-surface motion-lift rounded-xl p-5">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="max-w-[12rem] text-right font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </motion.article>
  )
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
  columns = "double",
}: {
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
  columns?: "single" | "double"
}) {
  return (
    <motion.section layout variants={reveal} className="rounded-xl border bg-white/50 p-4">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className={columns === "single" ? "mt-4 grid gap-4" : "mt-4 grid gap-4 md:grid-cols-2"}>
        {children}
      </div>
    </motion.section>
  )
}

function Field({
  id,
  label,
  type = "text",
  registration,
  error,
}: {
  id: keyof ProfileFormInput
  label: string
  type?: string
  registration: UseFormRegisterReturn
  error?: string
}) {
  return (
    <motion.div layout className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} {...registration} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </motion.div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="min-h-9 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        {value}
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Card key={item}>
            <CardHeader>
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-7 w-20 rounded bg-muted" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-10 rounded bg-muted" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
