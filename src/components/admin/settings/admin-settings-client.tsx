"use client"

import type { Route } from "next"
import Link from "next/link"
import {
  Bell,
  Bot,
  CreditCard,
  Edit3,
  Globe,
  KeyRound,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Plus,
  Power,
  Save,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form"
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
import {
  DEFAULT_LEAVE_REVIEW_NOTICE,
  readLeaveManagementSettings,
} from "@/lib/leaves/settings"
import {
  useCreateHostel,
  useHostels,
  useOrganizationSettings,
  useUpdateHostel,
  useUpdateOrganizationSettings,
} from "@/hooks"
import type { Tables } from "@/types/database"

const organizationFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(180).optional(),
  billingEmail: z.string().trim().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(20).optional(),
  addressLine1: z.string().trim().max(240).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(24).optional(),
  country: z.string().trim().max(80).optional(),
  timezone: z.string().trim().max(80).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  faviconUrl: z.string().trim().url().optional().or(z.literal("")),
  primaryColor: z.string().trim().max(20).optional(),
})

const platformControlsSchema = z.object({
  launchMode: z.enum(["setup", "staging", "soft_launch", "active"]),
  maintenanceEnabled: z.boolean(),
  maintenanceMessage: z.string().trim().max(240).optional(),
  launchBanner: z.string().trim().max(240).optional(),
  supportWhatsapp: z.string().trim().max(20).optional(),
  financeWhatsapp: z.string().trim().max(20).optional(),
  enquiryWhatsapp: z.string().trim().max(20).optional(),
  inviteExpiryDays: z.coerce.number().int().min(1).max(90),
  tempPasswordExpiryHours: z.coerce.number().int().min(1).max(168),
  requireDocumentVerification: z.boolean(),
  allowPaymentsBeforeVerification: z.boolean(),
  autoResendInviteReminders: z.boolean(),
  admissionsEnabled: z.boolean(),
  paymentsEnabled: z.boolean(),
  cmsEnabled: z.boolean(),
  automationEnabled: z.boolean(),
  staffAccessEnabled: z.boolean(),
})

const leaveManagementSchema = z.object({
  leaveWhatsappSupportNumber: z.string().trim().max(24).optional(),
  leaveReviewNotice: z.string().trim().min(10).max(240),
  leaveUrgentEscalationEnabled: z.boolean(),
})

const hostelFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9-]+$/),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  capacity: z.coerce.number().int().min(0).max(1000),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  addressLine1: z.string().trim().max(240).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(24).optional(),
})

type OrganizationFormValues = z.infer<typeof organizationFormSchema>
type PlatformControlsInput = z.input<typeof platformControlsSchema>
type PlatformControlsValues = z.output<typeof platformControlsSchema>
type LeaveManagementInput = z.input<typeof leaveManagementSchema>
type LeaveManagementValues = z.output<typeof leaveManagementSchema>
type HostelFormInput = z.input<typeof hostelFormSchema>
type HostelFormValues = z.output<typeof hostelFormSchema>

const operationLinks: Array<{
  title: string
  description: string
  href: string
  icon: LucideIcon
}> = [
  {
    title: "Residents",
    description: "Create, invite, verify, suspend, transfer, mark left, and repair residents.",
    href: "/admin/residents",
    icon: Users,
  },
  {
    title: "Payments",
    description: "Review UPI proofs, reject or verify payments, and inspect dues.",
    href: "/admin/payments",
    icon: CreditCard,
  },
  {
    title: "Payment security",
    description: "Rotate QR, UPI IDs, instructions, and verification settings.",
    href: "/admin/finance/payment-security",
    icon: ShieldCheck,
  },
  {
    title: "Automation",
    description: "Run consistency scans, dry-run repairs, execute repairs, and tune jobs.",
    href: "/admin/operations/automation",
    icon: Bot,
  },
  {
    title: "Website CMS",
    description: "Edit website content, gallery, notices, facilities, and public messaging.",
    href: "/admin/website",
    icon: Globe,
  },
  {
    title: "Staff access",
    description: "Create staff, assign roles, reset passwords, suspend, and revoke access.",
    href: "/admin/settings/staff-access",
    icon: KeyRound,
  },
  {
    title: "Rules & Policies",
    description: "Manage hostel rules shown on the website, resident portal, and onboarding.",
    href: "/admin/settings/rules",
    icon: ShieldCheck,
  },
  {
    title: "Operational alerts",
    description: "Resolve recovery requests, anomalies, failed jobs, and launch blockers.",
    href: "/admin/alerts",
    icon: LifeBuoy,
  },
  {
    title: "Launch readiness",
    description: "Check monitoring, storage, cron, signed URLs, safeguards, and rollout gates.",
    href: "/admin/launch-readiness",
    icon: Bell,
  },
]

export function AdminSettingsClient() {
  const { organizationId } = useAuth()
  const organizationQuery = useOrganizationSettings(Boolean(organizationId))
  const hostelsQuery = useHostels(Boolean(organizationId))
  const updateOrganization = useUpdateOrganizationSettings()
  const createHostel = useCreateHostel()
  const updateHostel = useUpdateHostel()
  const [showHostelForm, setShowHostelForm] = useState(false)
  const [editingHostelId, setEditingHostelId] = useState<string | null>(null)
  const organizationForm = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: "",
      legalName: "",
      billingEmail: "",
      contactPhone: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
      timezone: "Asia/Kolkata",
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "#0f766e",
    },
  })
  const platformControlsForm = useForm<PlatformControlsInput, unknown, PlatformControlsValues>({
    resolver: zodResolver(platformControlsSchema),
    defaultValues: defaultPlatformControls(),
  })
  const leaveManagementForm = useForm<LeaveManagementInput, unknown, LeaveManagementValues>({
    resolver: zodResolver(leaveManagementSchema),
    defaultValues: defaultLeaveManagementSettings(),
  })
  const hostelForm = useForm<HostelFormInput, unknown, HostelFormValues>({
    resolver: zodResolver(hostelFormSchema),
    defaultValues: {
      name: "",
      code: "",
      slug: "",
      capacity: 70,
      phone: "",
      email: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
    },
  })
  const editHostelForm = useForm<HostelFormInput, unknown, HostelFormValues>({
    resolver: zodResolver(hostelFormSchema),
    defaultValues: {
      name: "",
      code: "",
      slug: "",
      capacity: 70,
      phone: "",
      email: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
    },
  })

  useEffect(() => {
    const organization = organizationQuery.data

    if (!organization) {
      return
    }

    const settings = recordFromJson(organization.settings)
    const branding = recordFromJson(settings.branding)

    organizationForm.reset({
      name: organization.name,
      legalName: organization.legal_name ?? "",
      billingEmail: organization.billing_email ?? "",
      contactPhone: organization.contact_phone ?? "",
      addressLine1: organization.address_line1 ?? "",
      city: organization.city ?? "",
      state: organization.state ?? "",
      postalCode: organization.postal_code ?? "",
      country: organization.country ?? "India",
      timezone: stringFromRecord(settings, "timezone") ?? "Asia/Kolkata",
      logoUrl: stringFromRecord(branding, "logoUrl") ?? "",
      faviconUrl: stringFromRecord(branding, "faviconUrl") ?? "",
      primaryColor: stringFromRecord(branding, "primaryColor") ?? "#0f766e",
    })

    platformControlsForm.reset(readPlatformControls(settings))
    leaveManagementForm.reset(readLeaveManagementControls(settings))
  }, [leaveManagementForm, organizationForm, organizationQuery.data, platformControlsForm])

  const editingHostel = hostelsQuery.data?.find((hostel) => hostel.id === editingHostelId)

  useEffect(() => {
    if (!editingHostel) {
      return
    }

    editHostelForm.reset({
      name: editingHostel.name,
      code: editingHostel.code,
      slug: editingHostel.slug,
      capacity: editingHostel.capacity,
      phone: editingHostel.phone ?? "",
      email: editingHostel.email ?? "",
      addressLine1: editingHostel.address_line1 ?? "",
      city: editingHostel.city ?? "",
      state: editingHostel.state ?? "",
      postalCode: editingHostel.postal_code ?? "",
    })
  }, [editHostelForm, editingHostel])

  async function saveOrganization(values: OrganizationFormValues) {
    if (!organizationId) {
      return
    }

    await updateOrganization.mutateAsync({
      organizationId,
      name: values.name,
      legalName: values.legalName || undefined,
      billingEmail: values.billingEmail || undefined,
      contactPhone: values.contactPhone || undefined,
      addressLine1: values.addressLine1 || undefined,
      addressLine2: undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      postalCode: values.postalCode || undefined,
      country: values.country || undefined,
      settings: {
        timezone: values.timezone || "Asia/Kolkata",
        branding: {
          logoUrl: values.logoUrl || undefined,
          faviconUrl: values.faviconUrl || undefined,
          primaryColor: values.primaryColor || "#0f766e",
        },
      },
    })
    toast.success("Organization settings saved.")
  }

  async function savePlatformControls(values: PlatformControlsValues) {
    if (!organizationId || !organizationQuery.data) {
      return
    }

    const currentSettings = recordFromJson(organizationQuery.data.settings)

    await updateOrganization.mutateAsync({
      organizationId,
      legalName: undefined,
      billingEmail: undefined,
      contactPhone: undefined,
      addressLine1: undefined,
      addressLine2: undefined,
      city: undefined,
      state: undefined,
      postalCode: undefined,
      country: undefined,
      settings: {
        ...currentSettings,
        operationalControls: {
          launchMode: values.launchMode,
          maintenance: {
            enabled: values.maintenanceEnabled,
            message: values.maintenanceMessage || undefined,
            banner: values.launchBanner || undefined,
          },
          support: {
            whatsapp: values.supportWhatsapp || undefined,
            financeWhatsapp: values.financeWhatsapp || undefined,
            enquiryWhatsapp: values.enquiryWhatsapp || undefined,
          },
          onboarding: {
            inviteExpiryDays: values.inviteExpiryDays,
            tempPasswordExpiryHours: values.tempPasswordExpiryHours,
            requireDocumentVerification: values.requireDocumentVerification,
            allowPaymentsBeforeVerification: values.allowPaymentsBeforeVerification,
            autoResendInviteReminders: values.autoResendInviteReminders,
          },
          features: {
            admissions: values.admissionsEnabled,
            payments: values.paymentsEnabled,
            cms: values.cmsEnabled,
            automation: values.automationEnabled,
            staffAccess: values.staffAccessEnabled,
          },
        },
      },
    })
    toast.success("Operational controls saved.")
  }

  async function saveLeaveManagement(values: LeaveManagementValues) {
    if (!organizationId || !organizationQuery.data) {
      return
    }

    const currentSettings = recordFromJson(organizationQuery.data.settings)

    await updateOrganization.mutateAsync({
      organizationId,
      legalName: undefined,
      billingEmail: undefined,
      contactPhone: undefined,
      addressLine1: undefined,
      addressLine2: undefined,
      city: undefined,
      state: undefined,
      postalCode: undefined,
      country: undefined,
      settings: {
        ...currentSettings,
        leaveManagement: {
          whatsappSupportNumber: values.leaveWhatsappSupportNumber || undefined,
          reviewNotice: values.leaveReviewNotice || DEFAULT_LEAVE_REVIEW_NOTICE,
          urgentWhatsappEscalationEnabled: values.leaveUrgentEscalationEnabled,
        },
      },
    })
    toast.success("Leave management settings saved.")
  }

  async function addHostel(values: HostelFormValues) {
    if (!organizationId) {
      return
    }

    await createHostel.mutateAsync({
      organizationId,
      name: values.name,
      code: values.code,
      slug: values.slug,
      capacity: values.capacity,
      phone: values.phone || undefined,
      email: values.email || undefined,
      addressLine1: values.addressLine1 || undefined,
      addressLine2: undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      postalCode: values.postalCode || undefined,
      settings: {},
    })
    hostelForm.reset()
    setShowHostelForm(false)
    toast.success("Hostel created.")
  }

  async function saveHostel(values: HostelFormValues) {
    if (!organizationId || !editingHostelId) {
      return
    }

    await updateHostel.mutateAsync({
      organizationId,
      hostelId: editingHostelId,
      name: values.name,
      code: values.code,
      slug: values.slug,
      capacity: values.capacity,
      phone: values.phone || undefined,
      email: values.email || undefined,
      addressLine1: values.addressLine1 || undefined,
      addressLine2: undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      postalCode: values.postalCode || undefined,
    })
    setEditingHostelId(null)
    toast.success("Hostel updated.")
  }

  async function toggleHostel(hostel: Tables<"hostels">) {
    if (!organizationId) {
      return
    }

    await updateHostel.mutateAsync({
      organizationId,
      hostelId: hostel.id,
      isActive: !hostel.is_active,
    })
    toast.success(hostel.is_active ? "Hostel deactivated." : "Hostel activated.")
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
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Manage business identity, address, and contact details without Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizationQuery.isError ? (
            <APIErrorState
              title="Organization could not be loaded"
              error={organizationQuery.error}
              onRetry={() => void organizationQuery.refetch()}
            />
          ) : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={organizationForm.handleSubmit(saveOrganization)}>
              <Field form={organizationForm} name="name" label="Organization name" />
              <Field form={organizationForm} name="legalName" label="Legal name" />
              <Field form={organizationForm} name="billingEmail" label="Billing email" />
              <Field form={organizationForm} name="contactPhone" label="Contact phone" />
              <Field form={organizationForm} name="addressLine1" label="Address" />
              <Field form={organizationForm} name="city" label="City" />
              <Field form={organizationForm} name="state" label="State" />
              <Field form={organizationForm} name="postalCode" label="Postal code" />
              <Field form={organizationForm} name="country" label="Country" />
              <Field form={organizationForm} name="timezone" label="Timezone" />
              <BrandImageField form={organizationForm} name="logoUrl" label="Brand logo URL" />
              <BrandImageField
                form={organizationForm}
                name="faviconUrl"
                label="Browser tab logo URL"
                previewClassName="size-10 rounded-md"
                imageClassName="object-contain"
              />
              <Field form={organizationForm} name="primaryColor" label="Brand color" />
              <div className="md:col-span-2">
                <Button disabled={updateOrganization.isPending} className="gap-2">
                  {updateOrganization.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save organization
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Operations</CardTitle>
          <CardDescription>
            Owner-managed business controls for launch state, support routing, resident access, and
            enabled modules. Infrastructure secrets, migrations, backups, and storage policies
            remain outside the admin panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizationQuery.isError ? (
            <APIErrorState
              title="Operational controls could not be loaded"
              error={organizationQuery.error}
              onRetry={() => void organizationQuery.refetch()}
            />
          ) : (
            <form
              className="grid gap-5"
              onSubmit={platformControlsForm.handleSubmit(savePlatformControls)}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <NativeSelectField
                  form={platformControlsForm}
                  name="launchMode"
                  label="Launch mode"
                  options={[
                    { value: "setup", label: "Setup" },
                    { value: "staging", label: "Staging" },
                    { value: "soft_launch", label: "Soft launch" },
                    { value: "active", label: "Active operations" },
                  ]}
                />
                <Field form={platformControlsForm} name="supportWhatsapp" label="Support WhatsApp" />
                <Field form={platformControlsForm} name="financeWhatsapp" label="Finance WhatsApp" />
                <Field form={platformControlsForm} name="enquiryWhatsapp" label="Enquiry WhatsApp" />
                <Field
                  form={platformControlsForm}
                  name="inviteExpiryDays"
                  label="Invite expiry days"
                  type="number"
                />
                <Field
                  form={platformControlsForm}
                  name="tempPasswordExpiryHours"
                  label="Temporary password hours"
                  type="number"
                />
              </div>

              <TextAreaField
                form={platformControlsForm}
                name="maintenanceMessage"
                label="Maintenance guidance"
              />
              <TextAreaField
                form={platformControlsForm}
                name="launchBanner"
                label="Launch banner"
              />

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <CheckboxField
                  form={platformControlsForm}
                  name="maintenanceEnabled"
                  label="Show business maintenance banner"
                  description="Use this for owner communication. Environment maintenance mode remains the emergency traffic stop."
                />
                <CheckboxField
                  form={platformControlsForm}
                  name="requireDocumentVerification"
                  label="Require document verification"
                  description="Residents need admin approval before full portal access."
                />
                <CheckboxField
                  form={platformControlsForm}
                  name="allowPaymentsBeforeVerification"
                  label="Allow payments before verification"
                  description="Keep off for stricter profile-verification finance."
                />
                <CheckboxField
                  form={platformControlsForm}
                  name="autoResendInviteReminders"
                  label="Auto-remind pending invites"
                  description="Automation can remind residents before invite expiry."
                />
                <CheckboxField
                  form={platformControlsForm}
                  name="admissionsEnabled"
                  label="Admissions enabled"
                  description="Leads, reservations, and resident invite access are available."
                />
                <CheckboxField
                  form={platformControlsForm}
                  name="paymentsEnabled"
                  label="Payments enabled"
                  description="Residents can submit manual UPI payment proofs."
                />
                <CheckboxField
                  form={platformControlsForm}
                  name="cmsEnabled"
                  label="Website CMS enabled"
                  description="Admins can edit public website content and gallery."
                />
                <CheckboxField
                  form={platformControlsForm}
                  name="automationEnabled"
                  label="Automation enabled"
                  description="Admin automation controls and scheduled operational jobs are available."
                />
                <CheckboxField
                  form={platformControlsForm}
                  name="staffAccessEnabled"
                  label="Staff access enabled"
                  description="Owners can create, suspend, and reset staff accounts."
                />
              </div>

              <div>
                <Button disabled={updateOrganization.isPending} className="gap-2">
                  {updateOrganization.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save operational controls
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-primary" aria-hidden="true" />
            Leave Management Settings
          </CardTitle>
          <CardDescription>
            Configure resident leave review messaging and urgent WhatsApp escalation without code changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizationQuery.isError ? (
            <APIErrorState
              title="Leave settings could not be loaded"
              error={organizationQuery.error}
              onRetry={() => void organizationQuery.refetch()}
            />
          ) : (
            <form
              className="grid gap-5"
              onSubmit={leaveManagementForm.handleSubmit(saveLeaveManagement)}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  form={leaveManagementForm}
                  name="leaveWhatsappSupportNumber"
                  label="WhatsApp Support Number"
                />
                <CheckboxField
                  form={leaveManagementForm}
                  name="leaveUrgentEscalationEnabled"
                  label="Enable Urgent Leave WhatsApp Escalation"
                  description="Residents see a WhatsApp escalation button before submission and while leave remains pending."
                />
              </div>
              <TextAreaField
                form={leaveManagementForm}
                name="leaveReviewNotice"
                label="Leave Review Notice"
              />
              <div>
                <Button disabled={updateOrganization.isPending} className="gap-2">
                  {updateOrganization.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save leave settings
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Self-Service Operations Map</CardTitle>
          <CardDescription>
            Common hostel operations and where owners should perform them from the admin panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {operationLinks.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className="rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h2 className="mt-3 text-sm font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 md:grid md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Hostels</CardTitle>
            <CardDescription>
              Create and manage hostel branches, capacities, and operating scope.
            </CardDescription>
          </div>
          <Button onClick={() => setShowHostelForm((value) => !value)} className="gap-2">
            <Plus className="size-4" />
            Add hostel
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          {showHostelForm ? (
            <form className="grid gap-4 rounded-lg border p-4 md:grid-cols-2" onSubmit={hostelForm.handleSubmit(addHostel)}>
              <Field form={hostelForm} name="name" label="Hostel name" />
              <Field form={hostelForm} name="code" label="Code" />
              <Field form={hostelForm} name="slug" label="URL slug" />
              <Field form={hostelForm} name="capacity" label="Capacity" type="number" />
              <Field form={hostelForm} name="phone" label="Phone" />
              <Field form={hostelForm} name="email" label="Email" />
              <Field form={hostelForm} name="addressLine1" label="Address" />
              <Field form={hostelForm} name="city" label="City" />
              <Field form={hostelForm} name="state" label="State" />
              <Field form={hostelForm} name="postalCode" label="Postal code" />
              <div className="md:col-span-2">
                <Button disabled={createHostel.isPending}>Create hostel</Button>
              </div>
            </form>
          ) : null}

          {hostelsQuery.isError ? (
            <APIErrorState
              title="Hostels could not be loaded"
              error={hostelsQuery.error}
              onRetry={() => void hostelsQuery.refetch()}
            />
          ) : hostelsQuery.data?.length === 0 ? (
            <EmptyState
              title="No hostel branches yet"
              message="Create your first hostel branch to unlock CMS, staff access, and payment configuration."
              action={<Button onClick={() => setShowHostelForm(true)}>Create hostel</Button>}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {hostelsQuery.data?.map((hostel) => (
                <article key={hostel.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{hostel.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {hostel.code} · {hostel.capacity} student capacity
                      </p>
                    </div>
                    <StatusBadge status={hostel.is_active ? "active" : "inactive"} />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    {hostel.city || hostel.phone || hostel.email || "Add branch contact and address details."}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setEditingHostelId(hostel.id)}
                    >
                      <Edit3 className="size-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={updateHostel.isPending}
                      onClick={() => void toggleHostel(hostel)}
                    >
                      <Power className="size-4" />
                      {hostel.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {editingHostel ? (
            <form
              className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2"
              onSubmit={editHostelForm.handleSubmit(saveHostel)}
            >
              <div className="md:col-span-2">
                <h3 className="font-semibold">Edit {editingHostel.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Changes update vacancy, CMS, and operational scope for this hostel.
                </p>
              </div>
              <Field form={editHostelForm} name="name" label="Hostel name" />
              <Field form={editHostelForm} name="code" label="Code" />
              <Field form={editHostelForm} name="slug" label="URL slug" />
              <Field form={editHostelForm} name="capacity" label="Capacity" type="number" />
              <Field form={editHostelForm} name="phone" label="Phone" />
              <Field form={editHostelForm} name="email" label="Email" />
              <Field form={editHostelForm} name="addressLine1" label="Address" />
              <Field form={editHostelForm} name="city" label="City" />
              <Field form={editHostelForm} name="state" label="State" />
              <Field form={editHostelForm} name="postalCode" label="Postal code" />
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button disabled={updateHostel.isPending} className="gap-2">
                  {updateHostel.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save hostel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingHostelId(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function recordFromJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function stringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]

  return typeof value === "string" ? value : undefined
}

function booleanFromRecord(
  record: Record<string, unknown>,
  key: string,
  fallback = false
) {
  const value = record[key]

  return typeof value === "boolean" ? value : fallback
}

function numberFromRecord(record: Record<string, unknown>, key: string, fallback: number) {
  const value = record[key]

  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function defaultPlatformControls(): PlatformControlsValues {
  return {
    launchMode: "soft_launch",
    maintenanceEnabled: false,
    maintenanceMessage: "",
    launchBanner: "",
    supportWhatsapp: "",
    financeWhatsapp: "",
    enquiryWhatsapp: "",
    inviteExpiryDays: 7,
    tempPasswordExpiryHours: 24,
    requireDocumentVerification: true,
    allowPaymentsBeforeVerification: false,
    autoResendInviteReminders: true,
    admissionsEnabled: true,
    paymentsEnabled: true,
    cmsEnabled: true,
    automationEnabled: true,
    staffAccessEnabled: true,
  }
}

function defaultLeaveManagementSettings(): LeaveManagementValues {
  return {
    leaveWhatsappSupportNumber: "",
    leaveReviewNotice: DEFAULT_LEAVE_REVIEW_NOTICE,
    leaveUrgentEscalationEnabled: true,
  }
}

function readLeaveManagementControls(settings: Record<string, unknown>): LeaveManagementValues {
  const leaveManagement = readLeaveManagementSettings(settings)

  return {
    leaveWhatsappSupportNumber: leaveManagement.whatsappSupportNumber,
    leaveReviewNotice: leaveManagement.reviewNotice,
    leaveUrgentEscalationEnabled: leaveManagement.urgentWhatsappEscalationEnabled,
  }
}

function readPlatformControls(settings: Record<string, unknown>): PlatformControlsValues {
  const controls = recordFromJson(settings.operationalControls)
  const maintenance = recordFromJson(controls.maintenance)
  const support = recordFromJson(controls.support)
  const onboarding = recordFromJson(controls.onboarding)
  const features = recordFromJson(controls.features)
  const launchMode = stringFromRecord(controls, "launchMode")
  const defaults = defaultPlatformControls()

  return {
    launchMode:
      launchMode === "setup" ||
      launchMode === "staging" ||
      launchMode === "soft_launch" ||
      launchMode === "active"
        ? launchMode
        : defaults.launchMode,
    maintenanceEnabled: booleanFromRecord(maintenance, "enabled", defaults.maintenanceEnabled),
    maintenanceMessage: stringFromRecord(maintenance, "message") ?? "",
    launchBanner: stringFromRecord(maintenance, "banner") ?? "",
    supportWhatsapp: stringFromRecord(support, "whatsapp") ?? "",
    financeWhatsapp: stringFromRecord(support, "financeWhatsapp") ?? "",
    enquiryWhatsapp: stringFromRecord(support, "enquiryWhatsapp") ?? "",
    inviteExpiryDays: numberFromRecord(onboarding, "inviteExpiryDays", defaults.inviteExpiryDays),
    tempPasswordExpiryHours: numberFromRecord(
      onboarding,
      "tempPasswordExpiryHours",
      defaults.tempPasswordExpiryHours
    ),
    requireDocumentVerification: booleanFromRecord(
      onboarding,
      "requireDocumentVerification",
      defaults.requireDocumentVerification
    ),
    allowPaymentsBeforeVerification: booleanFromRecord(
      onboarding,
      "allowPaymentsBeforeVerification",
      defaults.allowPaymentsBeforeVerification
    ),
    autoResendInviteReminders: booleanFromRecord(
      onboarding,
      "autoResendInviteReminders",
      defaults.autoResendInviteReminders
    ),
    admissionsEnabled: booleanFromRecord(features, "admissions", defaults.admissionsEnabled),
    paymentsEnabled: booleanFromRecord(features, "payments", defaults.paymentsEnabled),
    cmsEnabled: booleanFromRecord(features, "cms", defaults.cmsEnabled),
    automationEnabled: booleanFromRecord(features, "automation", defaults.automationEnabled),
    staffAccessEnabled: booleanFromRecord(features, "staffAccess", defaults.staffAccessEnabled),
  }
}

function Field<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
>({
  form,
  name,
  label,
  type = "text",
}: {
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>
  name: Path<TFieldValues>
  label: string
  type?: string
}) {
  const error = form.formState.errors[name]?.message

  return (
    <div className="grid gap-2">
      <Label htmlFor={String(name)}>{label}</Label>
      <Input id={String(name)} type={type} aria-invalid={Boolean(error)} {...form.register(name)} />
      {error ? <p className="text-xs text-destructive">{String(error)}</p> : null}
    </div>
  )
}

function BrandImageField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
>({
  form,
  name,
  label,
  previewClassName = "size-12 rounded-lg",
  imageClassName = "object-cover",
}: {
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>
  name: Path<TFieldValues>
  label: string
  previewClassName?: string
  imageClassName?: string
}) {
  const error = form.formState.errors[name]?.message
  const rawValue = form.watch(name)
  const previewUrl = typeof rawValue === "string" ? rawValue.trim() : ""

  return (
    <div className="grid gap-2">
      <Label htmlFor={String(name)}>{label}</Label>
      <Input id={String(name)} type="url" aria-invalid={Boolean(error)} {...form.register(name)} />
      {previewUrl ? (
        <div className="flex min-h-16 items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <span
            className={`flex shrink-0 items-center justify-center overflow-hidden border bg-background ${previewClassName}`}
          >
            {/* Remote admin-provided branding URLs are previewed directly in this client form. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="" className={`size-full ${imageClassName}`} />
          </span>
          <span className="min-w-0 truncate text-sm text-muted-foreground">{previewUrl}</span>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{String(error)}</p> : null}
    </div>
  )
}

function TextAreaField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
>({
  form,
  name,
  label,
}: {
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>
  name: Path<TFieldValues>
  label: string
}) {
  const error = form.formState.errors[name]?.message

  return (
    <div className="grid gap-2">
      <Label htmlFor={String(name)}>{label}</Label>
      <Textarea id={String(name)} aria-invalid={Boolean(error)} {...form.register(name)} />
      {error ? <p className="text-xs text-destructive">{String(error)}</p> : null}
    </div>
  )
}

function NativeSelectField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
>({
  form,
  name,
  label,
  options,
}: {
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>
  name: Path<TFieldValues>
  label: string
  options: Array<{ value: string; label: string }>
}) {
  const error = form.formState.errors[name]?.message

  return (
    <div className="grid gap-2">
      <Label htmlFor={String(name)}>{label}</Label>
      <select
        id={String(name)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        aria-invalid={Boolean(error)}
        {...form.register(name)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-destructive">{String(error)}</p> : null}
    </div>
  )
}

function CheckboxField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
>({
  form,
  name,
  label,
  description,
}: {
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>
  name: Path<TFieldValues>
  label: string
  description: string
}) {
  return (
    <label className="flex min-h-28 gap-3 rounded-lg border p-4">
      <input type="checkbox" className="mt-1 size-4" {...form.register(name)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}
