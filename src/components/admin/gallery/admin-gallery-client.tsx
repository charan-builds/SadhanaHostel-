"use client"

import { ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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
  DialogTrigger,
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
import { hostelGalleryImages, hostelImages } from "@/constants/hostel-images"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { canonicalizeGalleryCategory, formatGalleryCategory } from "@/lib/public-gallery"
import { useDeleteGalleryItem, useGallery, useUploadGalleryImage } from "@/hooks"

type GallerySlot = {
  id: string
  title: string
  category: string
  aliases: string[]
  fallbackImage?: string
  defaultTitle: string
  defaultAlt: string
  description: string
  visibleIn: string[]
}

type SlotGalleryItem = {
  id: string
  title: string
  category: string
  status: string
  imageUrl?: string | null
  alt_text?: string | null
}

type GalleryDeleteTarget = {
  id: string
  title: string
}

const gallerySlots: GallerySlot[] = [
  {
    id: "exterior-surroundings",
    title: "Exterior / Surroundings",
    category: "exterior-surroundings",
    aliases: ["exterior-surroundings", "exterior", "surroundings", "hero", "hostel", "building"],
    fallbackImage: hostelImages.hero,
    defaultTitle: "Exterior / Surroundings",
    defaultAlt: "Sadhana Boys Hostel exterior view in Pulivendula",
    description: "Outdoor building, gate, street, and surroundings photos.",
    visibleIn: ["Homepage hero", "Homepage gallery", "Gallery page"],
  },
  {
    id: "student-room",
    title: "Student rooms",
    category: "student-room",
    aliases: ["student-room", "student room", "student rooms", "students", "college"],
    fallbackImage: hostelImages.uploadedRooms,
    defaultTitle: "Student rooms",
    defaultAlt: "Student room at Sadhana Boys Hostel Pulivendula",
    description: "Photos of student resident room areas.",
    visibleIn: ["Gallery page", "Homepage gallery"],
  },
  {
    id: "employee-room",
    title: "Employee rooms",
    category: "employee-room",
    aliases: ["employee-room", "employee room", "employee rooms", "working", "professional"],
    fallbackImage: hostelImages.building,
    defaultTitle: "Employee rooms",
    defaultAlt: "Employee room at Sadhana Boys Hostel Pulivendula",
    description: "Photos of employee resident room areas.",
    visibleIn: ["Gallery page", "Homepage gallery"],
  },
  {
    id: "open-space-terrace",
    title: "Open space / Terrace",
    category: "open-space-terrace",
    aliases: ["open-space-terrace", "open space", "terrace", "common area", "facility", "facilities"],
    fallbackImage: hostelImages.uploadedFacility,
    defaultTitle: "Open space / Terrace",
    defaultAlt: "Open space and terrace at Sadhana Boys Hostel Pulivendula",
    description: "Photos of terrace, open space, common areas, and shared facilities.",
    visibleIn: ["Facilities page", "Homepage facilities", "Gallery page"],
  },
]

const galleryCategoryOptions = [
  { value: "student-room", label: "Student rooms" },
  { value: "employee-room", label: "Employee rooms" },
  { value: "open-space-terrace", label: "Open space / Terrace" },
  { value: "exterior-surroundings", label: "Exterior / Surroundings" },
] as const
const galleryAdminPageSize = 100

function findGallerySlotItems<T extends SlotGalleryItem>(items: T[], slot: GallerySlot) {
  return items.filter((item) => matchesGallerySlot(item, slot))
}

function getGalleryItemUsage(item: SlotGalleryItem) {
  return Array.from(
    new Set(
      gallerySlots.flatMap((slot) => (matchesGallerySlot(item, slot) ? slot.visibleIn : []))
    )
  )
}

function pickPreferredSlotItem<T extends SlotGalleryItem>(items: T[]) {
  return items.find((item) => item.status === "published") ?? items[0]
}

function matchesGallerySlot(item: SlotGalleryItem, slot: GallerySlot) {
  const category = normalizeGallerySlotKey(item.category)
  const title = normalizeGallerySlotKey(item.title)

  return slot.aliases.some((alias) => {
    const slotAlias = normalizeGallerySlotKey(alias)

    return (
      category === slotAlias ||
      title === slotAlias ||
      title.startsWith(`${slotAlias}-`)
    )
  })
}

function normalizeGallerySlotKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function isLogoGalleryItem(item: Pick<SlotGalleryItem, "category" | "title">) {
  const category = normalizeGallerySlotKey(item.category)
  const title = normalizeGallerySlotKey(item.title)

  return (
    category === "logo" ||
    category === "brand" ||
    title.includes("logo") ||
    title.includes("brand-mark")
  )
}

function buildGalleryUploadTitle(
  title: string,
  file: File,
  index: number,
  totalFiles: number
) {
  const baseTitle = title.trim() || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")

  return totalFiles === 1 ? baseTitle : `${baseTitle} ${index + 1}`
}

function buildGalleryUploadAltText(
  altText: string,
  title: string,
  index: number,
  totalFiles: number
) {
  const baseAltText = altText.trim()

  if (!baseAltText) {
    return title
  }

  return totalFiles === 1 ? baseAltText : `${baseAltText} ${index + 1}`
}

function buildGalleryUploadSortOrder(category: string, existingItemCount: number, index: number) {
  return canonicalizeGalleryCategory(category) === "logo" ? 0 : existingItemCount + index
}

export function AdminGalleryClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const publicOrganizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
  const publicHostelId = process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID
  const galleryOrganizationId = publicOrganizationId || organizationId
  const galleryHostelId = publicHostelId || hostelId
  const usesPublicWebsiteSource =
    Boolean(publicOrganizationId) &&
    (publicOrganizationId !== organizationId || publicHostelId !== hostelId)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<GallerySlot | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GalleryDeleteTarget | null>(null)
  const [formValues, setFormValues] = useState({
    title: "",
    description: "",
    category: "exterior-surroundings",
    altText: "",
  })
  const galleryQuery = useGallery({
    organizationId: galleryOrganizationId ?? "",
    hostelId: galleryHostelId,
    page: 1,
    pageSize: galleryAdminPageSize,
  })
  const uploadGalleryImage = useUploadGalleryImage()
  const deleteGalleryItem = useDeleteGalleryItem()

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  const items = (galleryQuery.data?.data ?? []).filter(
    (item) => !isLogoGalleryItem(item)
  )

  function openSlotUpload(slot: GallerySlot) {
    setSelectedSlot(slot)
    setSelectedFiles([])
    setUploadProgress(null)
    setFormValues({
      title: slot.defaultTitle,
      description: slot.description,
      category: slot.category,
      altText: slot.defaultAlt,
    })
    setUploadOpen(true)
  }

  function openGeneralUpload() {
    setSelectedSlot(null)
    setSelectedFiles([])
    setUploadProgress(null)
    setFormValues({
      title: "",
      description: "",
      category: "exterior-surroundings",
      altText: "",
    })
    setUploadOpen(true)
  }

  function handleUploadOpenChange(open: boolean) {
    setUploadOpen(open)

    if (!open) {
      setSelectedSlot(null)
      setSelectedFiles([])
      setUploadProgress(null)
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!galleryOrganizationId) {
      return
    }

    if (selectedFiles.length === 0) {
      toast.error("Choose at least one hostel photo before uploading.")
      return
    }

    setUploadProgress(0)

    try {
      for (const [index, file] of selectedFiles.entries()) {
        const title = buildGalleryUploadTitle(formValues.title, file, index, selectedFiles.length)

        await uploadGalleryImage.mutateAsync({
          file,
          input: {
            organizationId: galleryOrganizationId,
            hostelId: galleryHostelId,
            title,
            description: formValues.description || undefined,
            category: formValues.category || "exterior-surroundings",
            altText: buildGalleryUploadAltText(formValues.altText, title, index, selectedFiles.length),
            sortOrder: buildGalleryUploadSortOrder(formValues.category, items.length, index),
            status: "published",
          },
          options: {
            onProgress: (progress) =>
              setUploadProgress(
                Math.round(((index + progress.percent / 100) / selectedFiles.length) * 100)
              ),
          },
        })
      }
      toast.success(
        `${selectedFiles.length} gallery photo${selectedFiles.length === 1 ? "" : "s"} uploaded.`
      )
      setSelectedFiles([])
      setUploadProgress(null)
      await galleryQuery.refetch()
      setFormValues({
        title: "",
        description: "",
        category: "exterior-surroundings",
        altText: "",
      })
      setSelectedSlot(null)
      setUploadOpen(false)
    } catch (error) {
      setUploadProgress(null)
      toast.error(error instanceof Error ? error.message : "Gallery image could not be uploaded.")
    }
  }

  async function handleRemoveGalleryItem() {
    if (!deleteTarget || !galleryOrganizationId) {
      return
    }

    await deleteGalleryItem.mutateAsync({
      galleryItemId: deleteTarget.id,
      organizationId: galleryOrganizationId,
    })
    toast.success("Gallery image removed.")
    setDeleteTarget(null)
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <GalleryMetric label="Gallery records" value={items.length} />
        <GalleryMetric
          label="Published"
          value={items.filter((item) => item.status === "published").length}
        />
        <GalleryMetric
          label="Categories"
          value={new Set(items.map((item) => canonicalizeGalleryCategory(item.category))).size}
        />
      </div>

      {usesPublicWebsiteSource ? (
        <div className="rounded-xl border bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          Gallery uploads are connected to the public website photo source, so images uploaded here
          are the same images the public pages read.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Public website photo groups</CardTitle>
          <CardDescription>
            Add multiple public-facing photos under each category. Public pages use the full group
            in gallery views and the newest published match where a single image is needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {gallerySlots.map((slot) => {
              const slotItems = findGallerySlotItems(items, slot)
              const primarySlotItem = pickPreferredSlotItem(slotItems)
              const previewItems = slotItems.filter((item) => item.imageUrl).slice(0, 4)
              const fallbackUrl = primarySlotItem?.imageUrl ?? slot.fallbackImage

              return (
                <article
                  key={slot.id}
                  className="grid overflow-hidden rounded-xl border bg-background shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-video bg-muted">
                    {previewItems.length > 0 ? (
                      <div
                        className={`grid size-full gap-1 bg-muted p-1 ${
                          previewItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
                        }`}
                      >
                        {previewItems.map((item) => (
                          <div
                            key={item.id}
                            role="img"
                            aria-label={item.alt_text ?? item.title}
                            className="size-full rounded-md bg-cover bg-center"
                            style={{ backgroundImage: `url("${item.imageUrl}")` }}
                          />
                        ))}
                      </div>
                    ) : fallbackUrl ? (
                      <div
                        role="img"
                        aria-label={slot.defaultAlt}
                        className="size-full bg-cover bg-center"
                        style={{ backgroundImage: `url("${fallbackUrl}")` }}
                      />
                    ) : (
                      <div className="grid size-full place-items-center">
                        <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
                      {slotItems.length > 0
                        ? `${slotItems.length} uploaded`
                        : "Fallback"}
                    </span>
                  </div>
                  <div className="grid gap-3 p-4">
                    <div>
                      <h2 className="text-sm font-semibold">{slot.title}</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {slot.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {slot.visibleIn.map((location) => (
                        <span
                          key={location}
                          className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          {location}
                        </span>
                      ))}
                    </div>
                    {slotItems.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {slotItems.length} photo{slotItems.length === 1 ? "" : "s"} in this
                        category. Primary:{" "}
                        <span className="font-medium text-foreground">
                          {primarySlotItem?.title}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Upload with category <code>{slot.category}</code> to start this group.
                      </p>
                    )}
                    {slotItems.length > 0 ? (
                      <div className="grid max-h-44 gap-2 overflow-y-auto pr-1">
                        {slotItems.slice(0, 8).map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 rounded-lg border bg-muted/30 p-2"
                          >
                            {item.imageUrl ? (
                              <div
                                role="img"
                                aria-label={item.alt_text ?? item.title}
                                className="size-10 rounded-md bg-cover bg-center"
                                style={{ backgroundImage: `url("${item.imageUrl}")` }}
                              />
                            ) : (
                              <div className="grid size-10 place-items-center rounded-md bg-muted">
                                <ImageIcon
                                  className="size-4 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                            <p className="truncate text-xs font-medium">{item.title}</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${item.title}`}
                              onClick={() =>
                                setDeleteTarget({
                                  id: item.id,
                                  title: item.title,
                                })
                              }
                            >
                              <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      variant={slotItems.length > 0 ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                      onClick={() => openSlotUpload(slot)}
                    >
                      <UploadCloud className="size-3.5" aria-hidden="true" />
                      Add photos
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Public Website Photo Source</CardTitle>
          <CardDescription>
            Published uploads here feed the Student rooms, Employee rooms, Open space / Terrace,
            and Exterior / Surroundings gallery groups. Each category can contain many photos. If
            no gallery records exist, the site uses the local fallback photos below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <div className="rounded-xl border bg-success-surface p-4 text-sm text-success-foreground">
              Public pages are currently using {items.filter((item) => item.status === "published").length} published admin-uploaded photo(s) across the approved gallery categories.
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-xl border bg-warning-surface p-4 text-sm text-warning-foreground">
                No uploaded gallery records were found for this hostel yet. Upload JPG, PNG, or WebP
                photos here and publish them to replace these fallbacks automatically.
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hostelGalleryImages.map((imageUrl) => (
                  <article key={imageUrl} className="overflow-hidden rounded-xl border bg-background">
                    <div
                      role="img"
                      aria-label={imageUrl}
                      className="aspect-video bg-cover bg-center"
                      style={{ backgroundImage: `url("${imageUrl}")` }}
                    />
                    <p className="truncate px-3 py-2 text-xs text-muted-foreground">
                      {imageUrl}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 md:grid md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Gallery</CardTitle>
            <CardDescription>
              Upload, publish, and preview hostel gallery images from the admin panel.
            </CardDescription>
          </div>
          <Dialog open={uploadOpen} onOpenChange={handleUploadOpenChange}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={openGeneralUpload}>
                <UploadCloud className="size-4" />
                Upload images
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleUpload}>
                <DialogHeader>
                  <DialogTitle>
                    {selectedSlot ? `Add ${selectedSlot.title} photos` : "Upload Gallery Images"}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedSlot
                      ? `These photos will be added to: ${selectedSlot.visibleIn.join(", ")}.`
                      : "Add public hostel photos. JPG, PNG, and WebP images up to 6 MB each are accepted."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="gallery-file">Images</Label>
                    <Input
                      id="gallery-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) =>
                        setSelectedFiles(Array.from(event.target.files ?? []))
                      }
                    />
                    {selectedFiles.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gallery-title">
                      {selectedFiles.length > 1 ? "Title prefix" : "Title"}
                    </Label>
                    <Input
                      id="gallery-title"
                      required
                      value={formValues.title}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="gallery-category">Category</Label>
                      <Select
                        value={formValues.category}
                        onValueChange={(value) =>
                          setFormValues((current) => ({
                            ...current,
                            category: value,
                          }))
                        }
                      >
                        <SelectTrigger id="gallery-category">
                          <SelectValue placeholder="Choose where this photo appears" />
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
                      <Label htmlFor="gallery-alt">Alt text</Label>
                      <Input
                        id="gallery-alt"
                        value={formValues.altText}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            altText: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gallery-description">Description</Label>
                    <Textarea
                      id="gallery-description"
                      value={formValues.description}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  {uploadProgress !== null ? (
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={uploadGalleryImage.isPending}
                    className="gap-2"
                  >
                    {uploadGalleryImage.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UploadCloud className="size-4" />
                    )}
                    {selectedFiles.length > 1 ? "Publish photos" : "Publish image"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {galleryQuery.isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 rounded-lg border bg-muted/50" />
              ))}
            </div>
          ) : galleryQuery.isError ? (
            <APIErrorState
              title="Gallery could not be loaded"
              error={galleryQuery.error}
              onRetry={() => void galleryQuery.refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No gallery images yet"
              message="Upload your first hostel photo to make the public gallery feel real and current."
              action={<Button onClick={openGeneralUpload}>Upload images</Button>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const usage = getGalleryItemUsage(item)

                return (
                  <article key={item.id} className="overflow-hidden rounded-lg border">
                    {item.imageUrl ? (
                      <div
                        role="img"
                        aria-label={item.alt_text ?? item.title}
                        className="aspect-video w-full bg-cover bg-center"
                        style={{ backgroundImage: `url("${item.imageUrl}")` }}
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-muted">
                        <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                    <div className="grid gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-semibold">{item.title}</h2>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={item.status} />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            aria-label={`Remove ${item.title}`}
                            onClick={() =>
                              setDeleteTarget({
                                id: item.id,
                                title: item.title,
                              })
                            }
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatGalleryCategory(item.category)}
                      </p>
                      {usage.length > 0 ? (
                        <div className="grid gap-2">
                          <p className="text-xs font-medium text-foreground">Shown in</p>
                          <div className="flex flex-wrap gap-1.5">
                            {usage.map((location) => (
                              <span
                                key={location}
                                className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary"
                              >
                                {location}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          This is a general gallery image.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {item.published_at
                          ? `Published ${formatDateTime(item.published_at)}`
                          : "Not published"}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title="Remove gallery image?"
        description={
          deleteTarget
            ? `${deleteTarget.title} will be removed from the admin gallery and public website photo groups.`
            : undefined
        }
        confirmLabel="Remove image"
        variant="danger"
        onConfirm={handleRemoveGalleryItem}
      />
    </div>
  )
}

function GalleryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ImageIcon className="size-5" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
