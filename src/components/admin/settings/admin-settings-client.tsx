"use client"

import type { Route } from "next"
import Link from "next/link"
import { Building2, Edit3, Loader2, Plus, Power, Save } from "lucide-react"
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
import { useAuth } from "@/lib/auth"
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
type HostelFormInput = z.input<typeof hostelFormSchema>
type HostelFormValues = z.output<typeof hostelFormSchema>

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
  }, [organizationForm, organizationQuery.data])

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
        title="Setup required"
        message="Create your organization and first hostel before editing settings."
        action={
          <Button asChild>
            <Link href={"/admin/setup" as Route}>Open setup wizard</Link>
          </Button>
        }
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
              <Field form={organizationForm} name="logoUrl" label="Logo URL" />
              <Field form={organizationForm} name="faviconUrl" label="Favicon URL" />
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
              message="Create your first hostel branch to unlock room, vacancy, CMS, and payment configuration."
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
                        {hostel.code} · {hostel.capacity} beds
                      </p>
                    </div>
                    <StatusBadge status={hostel.is_active ? "active" : "inactive"} />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="size-4" />
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
