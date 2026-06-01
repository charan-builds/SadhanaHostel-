"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { FilePenLine, Globe, Loader2, Plus, Sparkles } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useAuth } from "@/lib/auth"
import { humanizeEnum } from "@/lib/format"
import {
  useCreateFacility,
  useFacilities,
  useUpdateFacility,
  useUpdateWebsiteSetting,
  useWebsiteSettings,
} from "@/hooks"
import type { Tables } from "@/types/database"

const cmsStatuses = ["draft", "published", "archived"] as const

const settingFormSchema = z.object({
  title: z.string().trim().max(160).optional(),
  seoTitle: z.string().trim().max(180).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  status: z.enum(cmsStatuses),
  contentJson: z.string().min(2).refine((value) => {
    try {
      JSON.parse(value)
      return true
    } catch {
      return false
    }
  }, "Content must be valid JSON."),
})

const facilityFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(1000).optional(),
  iconName: z.string().trim().max(80).optional(),
  isHighlighted: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  status: z.enum(cmsStatuses),
})

type SettingFormValues = z.infer<typeof settingFormSchema>
type FacilityFormInput = z.input<typeof facilityFormSchema>
type FacilityFormValues = z.output<typeof facilityFormSchema>

export function AdminWebsiteClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [editingSetting, setEditingSetting] = useState<Tables<"website_settings"> | null>(
    null
  )
  const [editingFacility, setEditingFacility] = useState<Tables<"facilities"> | null>(
    null
  )
  const [isFacilityDialogOpen, setIsFacilityDialogOpen] = useState(false)

  const settingsQuery = useWebsiteSettings({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 50,
  })
  const facilitiesQuery = useFacilities({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 50,
  })

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  const settings = settingsQuery.data?.data ?? []
  const facilities = facilitiesQuery.data?.data ?? []

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <CmsMetric label="CMS sections" value={settings.length} />
        <CmsMetric
          label="Published sections"
          value={settings.filter((item) => item.status === "published").length}
        />
        <CmsMetric label="Facilities" value={facilities.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Website Sections</CardTitle>
          <CardDescription>
            Edit public website JSON content, SEO metadata, and publication status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <CmsSkeleton />
          ) : settingsQuery.isError ? (
            <APIErrorState
              title="CMS settings could not be loaded"
              error={settingsQuery.error}
              onRetry={() => void settingsQuery.refetch()}
            />
          ) : settings.length === 0 ? (
            <EmptyState
              title="No website sections yet"
              message="Starter homepage, SEO, contact, and pricing sections have not been created yet."
            />
          ) : (
            <div className="grid gap-3">
              {settings.map((setting) => (
                <article key={setting.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={setting.status} />
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {setting.section_key}
                        </span>
                      </div>
                      <h2 className="mt-3 font-semibold">{setting.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {setting.seo_title || "SEO title not set"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setEditingSetting(setting)}
                    >
                      <FilePenLine className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Facilities</CardTitle>
            <CardDescription>
              Facilities feed the public homepage and facilities page.
            </CardDescription>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingFacility(null)
              setIsFacilityDialogOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add facility
          </Button>
        </CardHeader>
        <CardContent>
          {facilitiesQuery.isLoading ? (
            <CmsSkeleton />
          ) : facilitiesQuery.isError ? (
            <APIErrorState
              title="Facilities could not be loaded"
              error={facilitiesQuery.error}
              onRetry={() => void facilitiesQuery.refetch()}
            />
          ) : facilities.length === 0 ? (
            <EmptyState
              title="No facilities yet"
              message="Add your first facility so families can see what the hostel provides."
              action={
                <Button
                  onClick={() => {
                    setEditingFacility(null)
                    setIsFacilityDialogOpen(true)
                  }}
                >
                  Add facility
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {facilities.map((facility) => (
                <article key={facility.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{facility.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {facility.description}
                      </p>
                    </div>
                    <div className="grid justify-items-end gap-2">
                      <StatusBadge status={facility.status} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setEditingFacility(facility)
                          setIsFacilityDialogOpen(true)
                        }}
                      >
                        <FilePenLine className="size-4" aria-hidden="true" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SettingEditorDialog
        setting={editingSetting}
        organizationId={organizationId}
        onClose={() => setEditingSetting(null)}
      />
      <FacilityDialog
        open={isFacilityDialogOpen}
        facility={editingFacility}
        onOpenChange={(open) => {
          setIsFacilityDialogOpen(open)

          if (!open) {
            setEditingFacility(null)
          }
        }}
        organizationId={organizationId}
        hostelId={hostelId}
      />
    </div>
  )
}

function SettingEditorDialog({
  setting,
  organizationId,
  onClose,
}: {
  setting: Tables<"website_settings"> | null
  organizationId: string
  onClose: () => void
}) {
  const updateSetting = useUpdateWebsiteSetting()
  const form = useForm<SettingFormValues>({
    resolver: zodResolver(settingFormSchema),
    defaultValues: getSettingDefaults(setting),
  })

  useEffect(() => {
    form.reset(getSettingDefaults(setting))
  }, [form, setting])

  async function onSubmit(values: SettingFormValues) {
    if (!setting) {
      return
    }

    await updateSetting.mutateAsync({
      settingId: setting.id,
      organizationId,
      title: values.title,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
      status: values.status,
      content: JSON.parse(values.contentJson) as Record<string, unknown>,
    })
    toast.success("Website section updated.")
    onClose()
  }

  return (
    <Dialog open={Boolean(setting)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit {setting?.section_key}</DialogTitle>
            <DialogDescription>
              Content is stored as structured JSON so frontend and backend contracts stay explicit.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input {...form.register("title")} />
            </div>
            <div className="grid gap-2">
              <Label>Content JSON</Label>
              <Textarea rows={12} className="font-mono text-xs" {...form.register("contentJson")} />
              {form.formState.errors.contentJson?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.contentJson.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>SEO title</Label>
                <Input {...form.register("seoTitle")} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cmsStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {humanizeEnum(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>SEO description</Label>
                <Textarea rows={3} {...form.register("seoDescription")} />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateSetting.isPending} className="gap-2">
              {updateSetting.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Globe className="size-4" aria-hidden="true" />
              )}
              Save section
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FacilityDialog({
  open,
  facility,
  onOpenChange,
  organizationId,
  hostelId,
}: {
  open: boolean
  facility: Tables<"facilities"> | null
  onOpenChange: (open: boolean) => void
  organizationId: string
  hostelId?: string
}) {
  const createFacility = useCreateFacility()
  const updateFacility = useUpdateFacility()
  const isEditing = Boolean(facility)
  const form = useForm<FacilityFormInput, unknown, FacilityFormValues>({
    resolver: zodResolver(facilityFormSchema),
    defaultValues: getFacilityDefaults(facility),
  })

  useEffect(() => {
    form.reset(getFacilityDefaults(facility))
  }, [facility, form, open])

  async function onSubmit(values: FacilityFormValues) {
    if (facility) {
      await updateFacility.mutateAsync({
        facilityId: facility.id,
        organizationId,
        hostelId: facility.hostel_id ?? hostelId,
        ...values,
      })
      toast.success("Facility updated.")
    } else {
      await createFacility.mutateAsync({
        organizationId,
        hostelId,
        ...values,
      })
      toast.success("Facility created.")
    }

    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Facility" : "Add Facility"}</DialogTitle>
            <DialogDescription>
              Published facilities are shown on the public website.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input {...form.register("slug")} placeholder="hot-water" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea rows={4} {...form.register("description")} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Icon name</Label>
                <Input {...form.register("iconName")} placeholder="wifi" />
              </div>
              <div className="grid gap-2">
                <Label>Sort order</Label>
                <Input type="number" min={0} {...form.register("sortOrder")} />
              </div>
              <div className="grid gap-2">
                <Label>Highlighted</Label>
                <Controller
                  control={form.control}
                  name="isHighlighted"
                  render={({ field }) => (
                    <Select
                      value={field.value ? "yes" : "no"}
                      onValueChange={(value) => field.onChange(value === "yes")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cmsStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {humanizeEnum(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createFacility.isPending || updateFacility.isPending}
              className="gap-2"
            >
              {createFacility.isPending || updateFacility.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {isEditing ? "Update facility" : "Save facility"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getSettingDefaults(setting: Tables<"website_settings"> | null): SettingFormValues {
  return {
    title: setting?.title ?? "",
    seoTitle: setting?.seo_title ?? "",
    seoDescription: setting?.seo_description ?? "",
    status: setting?.status ?? "draft",
    contentJson: JSON.stringify(setting?.content ?? {}, null, 2),
  }
}

function getFacilityDefaults(facility: Tables<"facilities"> | null): FacilityFormInput {
  return {
    name: facility?.name ?? "",
    slug: facility?.slug ?? "",
    description: facility?.description ?? "",
    iconName: facility?.icon_name ?? "sparkles",
    isHighlighted: facility?.is_highlighted ?? false,
    sortOrder: facility?.sort_order ?? 0,
    status: facility?.status ?? "published",
  }
}

function CmsMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Globe className="size-5" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function CmsSkeleton() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-24 rounded-lg border bg-muted/50" />
      ))}
    </div>
  )
}
