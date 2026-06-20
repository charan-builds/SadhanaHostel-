"use client"

import { useEffect, useState, type FormEvent } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { FilePenLine, Globe, ImageIcon, Loader2, Plus, Sparkles, UploadCloud } from "lucide-react"
import {
  Controller,
  type Control,
  type UseFormRegister,
  useForm,
  useWatch,
} from "react-hook-form"
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
  useGallery,
  useUpdateFacility,
  useUpdateWebsiteSetting,
  useUploadGalleryImage,
  useWebsiteSettings,
} from "@/hooks"
import type { Tables } from "@/types/database"

const cmsStatuses = ["draft", "published", "archived"] as const

const settingFormSchema = z.object({
  title: z.string().trim().max(160).optional(),
  seoTitle: z.string().trim().max(180).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  status: z.enum(cmsStatuses),
  fields: z.record(z.string(), z.string().max(5000)).default({}),
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

type SettingFormInput = z.input<typeof settingFormSchema>
type SettingFormValues = z.output<typeof settingFormSchema>
type FacilityFormInput = z.input<typeof facilityFormSchema>
type FacilityFormValues = z.output<typeof facilityFormSchema>

const galleryCategoryOptions = [
  { value: "student-room", label: "Student rooms" },
  { value: "employee-room", label: "Employee rooms" },
  { value: "open-space-terrace", label: "Open space / Terrace" },
  { value: "exterior-surroundings", label: "Exterior / Surroundings" },
] as const

function isLogoGalleryItem(item: { category: string; title: string }) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  const category = normalize(item.category)
  const title = normalize(item.title)

  return (
    category === "logo" ||
    category === "brand" ||
    title.includes("logo") ||
    title.includes("brand-mark")
  )
}

export function AdminWebsiteClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const publicOrganizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
  const publicHostelId = process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID
  const galleryOrganizationId = publicOrganizationId || organizationId
  const galleryHostelId = publicHostelId || hostelId
  const [editingSetting, setEditingSetting] = useState<Tables<"website_settings"> | null>(
    null
  )
  const [editingFacility, setEditingFacility] = useState<Tables<"facilities"> | null>(
    null
  )
  const [isFacilityDialogOpen, setIsFacilityDialogOpen] = useState(false)
  const [galleryFiles, setGalleryFiles] = useState<File[]>([])
  const [galleryProgress, setGalleryProgress] = useState<number | null>(null)
  const [galleryForm, setGalleryForm] = useState({
    title: "",
    description: "",
    altText: "",
    category: "exterior-surroundings",
  })

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
  const galleryQuery = useGallery({
    organizationId: galleryOrganizationId ?? "",
    hostelId: galleryHostelId,
    page: 1,
    pageSize: 12,
  })
  const uploadGalleryImage = useUploadGalleryImage()

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
  const galleryItems = (galleryQuery.data?.data ?? []).filter(
    (item) => !isLogoGalleryItem(item)
  )

  async function uploadGalleryImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!galleryOrganizationId) {
      toast.error("Website gallery source is not ready yet.")
      return
    }

    if (galleryFiles.length === 0) {
      toast.error("Choose at least one hostel photo.")
      return
    }

    setGalleryProgress(0)

    try {
      for (const [index, file] of galleryFiles.entries()) {
        const title =
          galleryForm.title.trim() ||
          file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
        const resolvedTitle =
          galleryFiles.length === 1 ? title : `${title} ${index + 1}`

        await uploadGalleryImage.mutateAsync({
          file,
          input: {
            organizationId: galleryOrganizationId,
            hostelId: galleryHostelId,
            title: resolvedTitle,
            description: galleryForm.description || undefined,
            altText: galleryForm.altText || resolvedTitle,
            category: galleryForm.category,
            sortOrder: galleryItems.length + index,
            status: "published",
          },
          options: {
            onProgress: (progress) =>
              setGalleryProgress(
                Math.round(((index + progress.percent / 100) / galleryFiles.length) * 100)
              ),
          },
        })
      }

      toast.success(
        `${galleryFiles.length} gallery image${galleryFiles.length === 1 ? "" : "s"} uploaded.`
      )
      setGalleryFiles([])
      setGalleryForm({
        title: "",
        description: "",
        altText: "",
        category: "exterior-surroundings",
      })
      setGalleryProgress(null)
      await galleryQuery.refetch()
    } catch (error) {
      setGalleryProgress(null)
      toast.error(error instanceof Error ? error.message : "Gallery upload failed.")
    }
  }

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
            Edit public website content, SEO metadata, and publication status with structured forms.
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
            <CardTitle>Facility Cards</CardTitle>
            <CardDescription>
              Repeatable cards for public homepage and facilities page highlights.
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

      <Card>
        <CardHeader>
          <CardTitle>Gallery Images</CardTitle>
          <CardDescription>
            Upload public hostel images without editing stored content by hand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={uploadGalleryImages} className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cms-gallery-file">Images</Label>
                  <Input
                    id="cms-gallery-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(event) =>
                      setGalleryFiles(Array.from(event.target.files ?? []))
                    }
                  />
                  {galleryFiles.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {galleryFiles.length} image{galleryFiles.length === 1 ? "" : "s"} selected.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="cms-gallery-title">
                      {galleryFiles.length > 1 ? "Title prefix" : "Title"}
                    </Label>
                    <Input
                      id="cms-gallery-title"
                      value={galleryForm.title}
                      onChange={(event) =>
                        setGalleryForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cms-gallery-category">Category</Label>
                    <Select
                      value={galleryForm.category}
                      onValueChange={(value) =>
                        setGalleryForm((current) => ({
                          ...current,
                          category: value,
                        }))
                      }
                    >
                      <SelectTrigger id="cms-gallery-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {galleryCategoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cms-gallery-alt">Alt text</Label>
                    <Input
                      id="cms-gallery-alt"
                      value={galleryForm.altText}
                      onChange={(event) =>
                        setGalleryForm((current) => ({
                          ...current,
                          altText: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cms-gallery-description">Description</Label>
                    <Input
                      id="cms-gallery-description"
                      value={galleryForm.description}
                      onChange={(event) =>
                        setGalleryForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                {galleryProgress !== null ? (
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${galleryProgress}%` }}
                    />
                  </div>
                ) : null}
                <div>
                  <Button
                    type="submit"
                    disabled={uploadGalleryImage.isPending}
                    className="gap-2"
                  >
                    {uploadGalleryImage.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <UploadCloud className="size-4" aria-hidden="true" />
                    )}
                    Upload images
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Latest published images</p>
                  <span className="text-xs text-muted-foreground">
                    {galleryItems.length} loaded
                  </span>
                </div>
                {galleryQuery.isLoading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="aspect-square rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : galleryQuery.isError ? (
                  <APIErrorState
                    title="Gallery could not be loaded"
                    error={galleryQuery.error}
                    onRetry={() => void galleryQuery.refetch()}
                  />
                ) : galleryItems.length === 0 ? (
                  <EmptyState
                    title="No gallery images"
                    message="Upload the first photo from this form."
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {galleryItems.slice(0, 6).map((item) =>
                      item.imageUrl ? (
                        <div
                          key={item.id}
                          role="img"
                          aria-label={item.alt_text ?? item.title}
                          className="aspect-square rounded-lg bg-cover bg-center"
                          style={{ backgroundImage: `url("${item.imageUrl}")` }}
                        />
                      ) : (
                        <div
                          key={item.id}
                          className="grid aspect-square place-items-center rounded-lg bg-muted"
                        >
                          <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </form>
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
  const form = useForm<SettingFormInput, unknown, SettingFormValues>({
    resolver: zodResolver(settingFormSchema),
    defaultValues: getSettingDefaults(setting),
  })

  useEffect(() => {
    form.reset(getSettingDefaults(setting))
  }, [form, setting])
  const watchedValues = useWatch({ control: form.control })
  const previewValues = normalizeSettingValues(watchedValues, setting)
  const previewContent = setting ? buildSettingContent(setting, previewValues) : {}

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
      content: buildSettingContent(setting, values),
    })
    toast.success("Website section updated.")
    onClose()
  }

  return (
    <Dialog open={Boolean(setting)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit {humanizeEnum(setting?.section_key ?? "website section")}</DialogTitle>
            <DialogDescription>
              Update the public website through owner-friendly fields.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Section title</Label>
                <Input {...form.register("title")} />
              </div>
              <div className="grid gap-4">
                {getSectionFields(setting).map((field) => (
                  <SettingFieldControl
                    key={field.name}
                    field={field}
                    control={form.control}
                    register={form.register}
                  />
                ))}
              </div>
              <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 md:grid-cols-2">
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
            <WebsitePreviewPanel
              setting={setting}
              values={previewValues}
              content={previewContent}
            />
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

function SettingFieldControl({
  field,
  control,
  register,
}: {
  field: SettingField
  control: Control<SettingFormInput, unknown, SettingFormValues>
  register: UseFormRegister<SettingFormInput>
}) {
  const fieldName = `fields.${field.name}` as const

  if (field.mode === "faq") {
    return (
      <FaqRowsEditor
        label={field.label}
        help={field.help}
        control={control}
        fieldName={fieldName}
      />
    )
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={`setting-${field.name}`}>{field.label}</Label>
      {field.multiline ? (
        <Textarea
          id={`setting-${field.name}`}
          rows={field.rows ?? 4}
          placeholder={field.placeholder}
          {...register(fieldName)}
        />
      ) : (
        <Input
          id={`setting-${field.name}`}
          type={field.inputType ?? "text"}
          placeholder={field.placeholder}
          {...register(fieldName)}
        />
      )}
      {field.help ? (
        <p className="text-xs text-muted-foreground">{field.help}</p>
      ) : null}
    </div>
  )
}

function FaqRowsEditor({
  label,
  help,
  control,
  fieldName,
}: {
  label: string
  help?: string
  control: Control<SettingFormInput, unknown, SettingFormValues>
  fieldName: `fields.${string}`
}) {
  return (
    <Controller
      control={control}
      name={fieldName}
      render={({ field }) => {
        const rows = parseFaqRows(String(field.value ?? ""))

        function updateRows(nextRows: FaqRow[]) {
          field.onChange(formatFaqRows(nextRows))
        }

        return (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>{label}</Label>
                {help ? <p className="mt-1 text-xs text-muted-foreground">{help}</p> : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateRows([...rows, { question: "", answer: "" }])}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add FAQ
              </Button>
            </div>
            <div className="grid gap-3">
              {(rows.length > 0 ? rows : [{ question: "", answer: "" }]).map((row, index) => (
                <div key={index} className="grid gap-2 rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      FAQ {index + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={rows.length <= 1}
                      onClick={() => updateRows(rows.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                  <Input
                    aria-label={`FAQ ${index + 1} question`}
                    placeholder="Question"
                    value={row.question}
                    onChange={(event) => {
                      const nextRows = [...rows]
                      nextRows[index] = {
                        ...row,
                        question: event.target.value,
                      }
                      updateRows(nextRows)
                    }}
                  />
                  <Textarea
                    aria-label={`FAQ ${index + 1} answer`}
                    placeholder="Answer"
                    rows={3}
                    value={row.answer}
                    onChange={(event) => {
                      const nextRows = [...rows]
                      nextRows[index] = {
                        ...row,
                        answer: event.target.value,
                      }
                      updateRows(nextRows)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      }}
    />
  )
}

function WebsitePreviewPanel({
  setting,
  values,
  content,
}: {
  setting: Tables<"website_settings"> | null
  values: SettingFormValues
  content: Record<string, unknown>
}) {
  const sectionKey = setting?.section_key ?? "homepage"
  const title = values.title || setting?.title || humanizeEnum(sectionKey)
  const seoTitle = values.seoTitle || title
  const seoDescription =
    values.seoDescription ||
    stringFromContent(content, ["default_description", "description", "about_text"]) ||
    "Public website description preview."
  const ogImage = stringFromContent(content, [
    "og_image",
    "ogImage",
    "og_image_url",
    "hero_image",
    "image_url",
  ])

  return (
    <aside className="grid content-start gap-4 xl:sticky xl:top-4">
      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Live Preview</p>
          <StatusBadge status={values.status} />
        </div>
        <SectionPreview sectionKey={sectionKey} title={title} content={content} />
      </div>
      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <p className="text-sm font-semibold">SEO Preview</p>
        <div className="mt-3 rounded-lg border bg-white p-3">
          <p className="truncate text-sm text-blue-700">{seoTitle}</p>
          <p className="mt-1 text-xs text-emerald-700">sadhanahostel.com</p>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">
            {seoDescription}
          </p>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border bg-muted/30">
          {ogImage ? (
            <div
              role="img"
              aria-label="Open graph preview image"
              className="aspect-[1.91/1] bg-cover bg-center"
              style={{ backgroundImage: `url("${ogImage}")` }}
            />
          ) : (
            <div className="grid aspect-[1.91/1] place-items-center bg-muted">
              <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <div className="grid gap-1 p-3">
            <p className="truncate text-sm font-medium">{seoTitle}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{seoDescription}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function SectionPreview({
  sectionKey,
  title,
  content,
}: {
  sectionKey: string
  title: string
  content: Record<string, unknown>
}) {
  if (sectionKey === "homepage") {
    const heroTitle = stringFromContent(content, ["hero_title"]) || title
    const heroSubtitle = stringFromContent(content, ["hero_subtitle"])
    const buttonText = stringFromContent(content, ["primary_cta"]) || "Contact Hostel"
    const buttonLink = stringFromContent(content, ["primary_cta_link"]) || "/contact"
    const highlights = stringListFromContent(content, "highlights").slice(0, 4)

    return (
      <div className="grid gap-3 rounded-lg bg-slate-950 p-4 text-white">
        <h3 className="text-xl font-semibold">{heroTitle}</h3>
        {heroSubtitle ? <p className="text-sm leading-6 text-slate-200">{heroSubtitle}</p> : null}
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-white px-3 py-2 text-xs font-medium text-slate-950">
            {buttonText}
          </span>
          <span className="rounded-md border border-white/30 px-3 py-2 text-xs">
            {buttonLink}
          </span>
        </div>
        {highlights.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((item) => (
              <span key={item} className="rounded-full bg-white/10 px-2 py-1 text-[11px]">
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (sectionKey === "about") {
    const heading = stringFromContent(content, ["heading"]) || title
    const description = stringFromContent(content, ["about_text", "description"])
    const values = stringListFromContent(content, "values").slice(0, 5)

    return (
      <div className="grid gap-3">
        <h3 className="text-lg font-semibold">{heading}</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {description || "About description appears here."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span key={value} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
              {value}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (sectionKey === "faq") {
    const items = faqRowsFromContent(content).slice(0, 4)

    return (
      <div className="grid gap-2">
        <h3 className="font-semibold">{title}</h3>
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.question} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{item.question}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.answer}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">FAQ rows appear here.</p>
        )}
      </div>
    )
  }

  if (sectionKey === "gallery") {
    const intro = stringFromContent(content, ["intro"])
    const categories = stringListFromContent(content, "categories")

    return (
      <div className="grid gap-3">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {intro || "Gallery intro appears here."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <span key={category} className="rounded-full bg-muted px-2 py-1 text-xs">
              {category}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {firstStringValue(content) || "Section content appears here."}
      </p>
    </div>
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
  const fields = Object.fromEntries(
    getSectionFields(setting).map((field) => [
      field.name,
      formatFieldValue(contentRecord(setting?.content), field),
    ])
  )

  return {
    title: setting?.title ?? "",
    seoTitle: setting?.seo_title ?? "",
    seoDescription: setting?.seo_description ?? "",
    status: setting?.status ?? "draft",
    fields,
  }
}

function normalizeSettingValues(
  values: Partial<Omit<SettingFormValues, "fields">> & {
    fields?: Record<string, string | undefined>
  },
  setting: Tables<"website_settings"> | null
): SettingFormValues {
  const defaults = getSettingDefaults(setting)
  const watchedFields = Object.fromEntries(
    Object.entries(values.fields ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  )

  return {
    title: values.title ?? defaults.title,
    seoTitle: values.seoTitle ?? defaults.seoTitle,
    seoDescription: values.seoDescription ?? defaults.seoDescription,
    status: cmsStatuses.includes(values.status as (typeof cmsStatuses)[number])
      ? (values.status as SettingFormValues["status"])
      : defaults.status,
    fields: {
      ...defaults.fields,
      ...watchedFields,
    },
  }
}

type FaqRow = {
  question: string
  answer: string
}

function parseFaqRows(value: string): FaqRow[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [question = "", answer = ""] = line.split("|").map((part) => part.trim())

      return { question, answer }
    })
    .filter((item) => item.question || item.answer)
}

function formatFaqRows(rows: FaqRow[]) {
  return rows
    .map((row) => `${row.question.trim()} | ${row.answer.trim()}`)
    .filter((line) => line !== " | ")
    .join("\n")
}

type SettingField = {
  name: string
  label: string
  key: string
  aliases?: string[]
  inputType?: "text" | "url" | "email" | "tel"
  multiline?: boolean
  rows?: number
  placeholder?: string
  help?: string
  mode?: "text" | "lines" | "faq" | "pricing"
}

const sectionFields: Record<string, SettingField[]> = {
  homepage: [
    {
      name: "heroTitle",
      label: "Hero title",
      key: "hero_title",
      aliases: ["heroTitle"],
      placeholder: "Sadhana Boys Hostel",
    },
    {
      name: "heroSubtitle",
      label: "Hero subtitle",
      key: "hero_subtitle",
      aliases: ["heroSubtitle"],
      multiline: true,
      rows: 3,
    },
    {
      name: "primaryCta",
      label: "Primary button text",
      key: "primary_cta",
      aliases: ["primaryCta"],
    },
    {
      name: "primaryCtaLink",
      label: "Primary button link",
      key: "primary_cta_link",
      aliases: ["primaryCtaLink", "primary_cta_url"],
      inputType: "url",
      placeholder: "/contact",
    },
    {
      name: "highlights",
      label: "Highlights",
      key: "highlights",
      mode: "lines",
      multiline: true,
      rows: 5,
      help: "Add one highlight per line.",
    },
  ],
  about: [
    {
      name: "heading",
      label: "Heading",
      key: "heading",
      aliases: ["headline"],
    },
    {
      name: "description",
      label: "Description",
      key: "about_text",
      aliases: ["aboutText", "description"],
      multiline: true,
      rows: 5,
    },
    {
      name: "managementNote",
      label: "Management note",
      key: "management_note",
      aliases: ["managementNote"],
      multiline: true,
      rows: 4,
    },
    {
      name: "values",
      label: "Values",
      key: "values",
      mode: "lines",
      multiline: true,
      rows: 5,
      help: "Add one value per line.",
    },
  ],
  contact: [
    { name: "phone", label: "Phone", key: "phone", inputType: "tel", placeholder: "+91 98765 43210" },
    { name: "whatsapp", label: "WhatsApp", key: "whatsapp", inputType: "tel", placeholder: "+91 98765 43210" },
    { name: "email", label: "Email", key: "email", inputType: "email", placeholder: "owner@sadhanahostel.com" },
    { name: "address", label: "Address", key: "address", multiline: true, rows: 3 },
    { name: "city", label: "City", key: "city" },
    { name: "mapLink", label: "Google Maps link", key: "map_link", aliases: ["mapLink"], inputType: "url" },
  ],
  pricing: [
    { name: "currency", label: "Currency", key: "currency", placeholder: "INR" },
    { name: "note", label: "Pricing note", key: "note", multiline: true, rows: 3 },
    {
      name: "feeStructure",
      label: "Room fee plans",
      key: "fee_structure",
      mode: "pricing",
      multiline: true,
      rows: 6,
      help: "One plan per line: Label | Monthly fee | Deposit | Description | Feature 1, Feature 2",
    },
  ],
  terms: [
    { name: "paymentRules", label: "Payment rules", key: "payment_rules", multiline: true, rows: 3 },
    { name: "leavePolicy", label: "Leave policy", key: "leave_policy", multiline: true, rows: 3 },
    { name: "conductRules", label: "Conduct rules", key: "conduct_rules", multiline: true, rows: 3 },
    {
      name: "rules",
      label: "Rule list",
      key: "rules",
      mode: "lines",
      multiline: true,
      rows: 5,
      help: "Add one rule per line.",
    },
  ],
  rules: [
    {
      name: "rules",
      label: "Hostel rules",
      key: "rules",
      mode: "lines",
      multiline: true,
      rows: 8,
      help: "Add one rule per line.",
    },
  ],
  facilities: [
    {
      name: "intro",
      label: "Facilities intro",
      key: "intro",
      multiline: true,
      rows: 4,
      help: "Individual facility cards are managed in the Facility Cards section below.",
    },
  ],
  faq: [
    {
      name: "items",
      label: "FAQ",
      key: "items",
      mode: "faq",
      help: "Add the questions families ask before admission.",
    },
  ],
  seo: [
    { name: "siteName", label: "Site name", key: "site_name", aliases: ["siteName"] },
    { name: "defaultTitle", label: "Default title", key: "default_title", aliases: ["defaultTitle"] },
    {
      name: "defaultDescription",
      label: "Default description",
      key: "default_description",
      aliases: ["defaultDescription"],
      multiline: true,
      rows: 3,
    },
    {
      name: "keywords",
      label: "SEO keywords",
      key: "keywords",
      mode: "lines",
      multiline: true,
      rows: 6,
      help: "Add one keyword per line.",
    },
    {
      name: "ogImage",
      label: "OG image URL",
      key: "og_image",
      aliases: ["ogImage", "og_image_url"],
      inputType: "url",
      placeholder: "https://example.com/hostel-photo.jpg",
    },
  ],
  gallery: [
    {
      name: "intro",
      label: "Gallery intro text",
      key: "intro",
      multiline: true,
      rows: 4,
    },
    {
      name: "categories",
      label: "Gallery categories",
      key: "categories",
      mode: "lines",
      multiline: true,
      rows: 6,
      help: "Add one category per line. Photos are managed from Gallery.",
    },
  ],
}

function getSectionFields(setting: Tables<"website_settings"> | null): SettingField[] {
  const sectionKey = setting?.section_key ?? "homepage"

  return sectionFields[sectionKey] ?? [
    {
      name: "body",
      label: "Content",
      key: "body",
      aliases: ["text", "description"],
      multiline: true,
      rows: 8,
    },
  ]
}

function buildSettingContent(
  setting: Tables<"website_settings">,
  values: SettingFormValues
): Record<string, unknown> {
  const content = { ...contentRecord(setting.content) }

  for (const field of getSectionFields(setting)) {
    const value = values.fields[field.name] ?? ""

    content[field.key] = parseFieldValue(value, field)
  }

  return content
}

function contentRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringFromContent(content: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = content[key]

    if (typeof value === "string" && value.trim()) {
      return value
    }
  }

  return ""
}

function stringListFromContent(content: Record<string, unknown>, key: string) {
  const value = content[key]

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  }

  return typeof value === "string"
    ? value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

function faqRowsFromContent(content: Record<string, unknown>) {
  const items = content.items

  if (Array.isArray(items)) {
    return items
      .map((item) => contentRecord(item))
      .map((item) => ({
        question: String(item.question ?? ""),
        answer: String(item.answer ?? ""),
      }))
      .filter((item) => item.question || item.answer)
  }

  return typeof items === "string" ? parseFaqRows(items) : []
}

function firstStringValue(content: Record<string, unknown>) {
  for (const value of Object.values(content)) {
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }

  return ""
}

function fieldSourceValue(content: Record<string, unknown>, field: SettingField) {
  const keys = [field.key, ...(field.aliases ?? [])]

  for (const key of keys) {
    if (content[key] !== undefined && content[key] !== null) {
      return content[key]
    }
  }

  return ""
}

function formatFieldValue(content: Record<string, unknown>, field: SettingField) {
  const value = fieldSourceValue(content, field)

  if (field.mode === "lines") {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").join("\n")
      : String(value ?? "")
  }

  if (field.mode === "faq") {
    return Array.isArray(value)
      ? formatFaqRows(
          value
            .map((item) => contentRecord(item))
            .map((item) => ({
              question: String(item.question ?? ""),
              answer: String(item.answer ?? ""),
            }))
        )
      : String(value ?? "")
  }

  if (field.mode === "pricing") {
    return Array.isArray(value)
      ? value
          .map((item) => contentRecord(item))
          .map((item) => {
            const features = Array.isArray(item.features)
              ? item.features.join(", ")
              : String(item.features ?? "")

            return [
              item.label,
              item.monthly_fee,
              item.deposit,
              item.description,
              features,
            ]
              .map((part) => String(part ?? ""))
              .join(" | ")
          })
          .join("\n")
      : String(value ?? "")
  }

  return String(value ?? "")
}

function parseFieldValue(value: string, field: SettingField): unknown {
  if (field.mode === "lines") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  }

  if (field.mode === "faq") {
    return parseFaqRows(value)
  }

  if (field.mode === "pricing") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label = "", monthlyFee = "0", deposit = "0", description = "", features = ""] =
          line.split("|").map((part) => part.trim())

        return {
          label,
          monthly_fee: Number(monthlyFee) || 0,
          deposit: Number(deposit) || 0,
          description,
          features: features
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }
      })
  }

  return value.trim()
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
