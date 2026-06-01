"use client"

import { ImageIcon, Loader2, UploadCloud } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { BrandMark } from "@/components/shared/brand-mark"
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
import { formatGalleryCategory } from "@/lib/public-gallery"
import { useGallery, useUploadGalleryImage } from "@/hooks"

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

const gallerySlots: GallerySlot[] = [
  {
    id: "logo",
    title: "Hostel logo",
    category: "logo",
    aliases: ["logo", "brand"],
    defaultTitle: "Sadhana Boys Hostel logo",
    defaultAlt: "Sadhana Boys Hostel logo",
    description: "Shown in the public website header, footer, mobile menu, and login pages.",
    visibleIn: ["Public header", "Public footer", "Login pages", "Mobile menu"],
  },
  {
    id: "hero",
    title: "Main hero / exterior",
    category: "hero",
    aliases: ["hero", "exterior", "hostel", "building"],
    fallbackImage: hostelImages.hero,
    defaultTitle: "Main hostel exterior",
    defaultAlt: "Sadhana Boys Hostel exterior view",
    description: "The first image visitors see on the public homepage.",
    visibleIn: ["Homepage hero", "Homepage gallery", "Gallery page"],
  },
  {
    id: "rooms",
    title: "Room previews",
    category: "room",
    aliases: ["room", "rooms", "accommodation"],
    fallbackImage: hostelImages.uploadedRooms,
    defaultTitle: "Room preview",
    defaultAlt: "Sadhana Boys Hostel room preview",
    description: "Used when public room cards need a real hostel room image.",
    visibleIn: ["Rooms page", "Homepage room cards", "Gallery page"],
  },
  {
    id: "student-room",
    title: "Student room",
    category: "student-room",
    aliases: ["student-room", "student room", "students", "college"],
    fallbackImage: hostelImages.uploadedRooms,
    defaultTitle: "Student room preview",
    defaultAlt: "Student room at Sadhana Boys Hostel",
    description: "Shown separately for college student accommodation on public room sections.",
    visibleIn: ["Homepage student room card", "Rooms page student plan", "Gallery page"],
  },
  {
    id: "employee-room",
    title: "Employee room",
    category: "employee-room",
    aliases: ["employee-room", "employee room", "working", "professional"],
    fallbackImage: hostelImages.building,
    defaultTitle: "Employee room preview",
    defaultAlt: "Employee room at Sadhana Boys Hostel",
    description: "Shown separately for employee and working professional accommodation.",
    visibleIn: ["Homepage employee room card", "Rooms page employee plan", "Gallery page"],
  },
  {
    id: "facilities",
    title: "Facility showcase",
    category: "facility",
    aliases: ["facility", "facilities", "dining", "amenity"],
    fallbackImage: hostelImages.uploadedFacility,
    defaultTitle: "Facility showcase",
    defaultAlt: "Sadhana Boys Hostel facility",
    description: "Used for facilities, amenities, dining, and common-area previews.",
    visibleIn: ["Facilities page", "Homepage facilities", "Gallery page"],
  },
  {
    id: "gallery",
    title: "Gallery grid",
    category: "gallery",
    aliases: ["gallery", "campus", "gate", "hostel", "exterior", "building"],
    fallbackImage: hostelImages.gate,
    defaultTitle: "Hostel gallery photo",
    defaultAlt: "Sadhana Boys Hostel gallery photo",
    description: "General photos shown across the public gallery and homepage gallery sections.",
    visibleIn: ["Gallery page", "Homepage gallery"],
  },
]

const galleryCategoryOptions = [
  { value: "hero", label: "Main hero / exterior" },
  { value: "student-room", label: "Student room" },
  { value: "employee-room", label: "Employee room" },
  { value: "room", label: "General room preview" },
  { value: "facility", label: "Facility showcase" },
  { value: "gallery", label: "Gallery grid" },
  { value: "logo", label: "Hostel logo" },
  { value: "hostel", label: "General hostel" },
] as const

function findGallerySlotItem<T extends SlotGalleryItem>(items: T[], slot: GallerySlot) {
  const matches = items.filter((item) => {
    const category = item.category.toLowerCase()
    const title = item.title.toLowerCase()

    return slot.aliases.some((alias) => category.includes(alias) || title.includes(alias))
  })

  return matches.find((item) => item.status === "published") ?? matches[0]
}

function getGalleryItemUsage(item: SlotGalleryItem) {
  const category = item.category.toLowerCase()
  const title = item.title.toLowerCase()

  return Array.from(
    new Set(
      gallerySlots.flatMap((slot) => {
        const matchesSlot = slot.aliases.some(
          (alias) => category.includes(alias) || title.includes(alias)
        )

        return matchesSlot ? slot.visibleIn : []
      })
    )
  )
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [formValues, setFormValues] = useState({
    title: "",
    description: "",
    category: "hostel",
    altText: "",
  })
  const galleryQuery = useGallery({
    organizationId: galleryOrganizationId ?? "",
    hostelId: galleryHostelId,
    page: 1,
    pageSize: 50,
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

  const items = galleryQuery.data?.data ?? []

  function openSlotUpload(slot: GallerySlot) {
    setSelectedSlot(slot)
    setSelectedFile(null)
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
    setSelectedFile(null)
    setUploadProgress(null)
    setFormValues({
      title: "",
      description: "",
      category: "hostel",
      altText: "",
    })
    setUploadOpen(true)
  }

  function handleUploadOpenChange(open: boolean) {
    setUploadOpen(open)

    if (!open) {
      setSelectedSlot(null)
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!galleryOrganizationId) {
      return
    }

    if (!selectedFile) {
      toast.error("Choose a hostel photo before uploading.")
      return
    }

    setUploadProgress(0)

    try {
      await uploadGalleryImage.mutateAsync({
        file: selectedFile,
        input: {
          organizationId: galleryOrganizationId,
          hostelId: galleryHostelId,
          title: formValues.title,
          description: formValues.description || undefined,
          category: formValues.category || "hostel",
          altText: formValues.altText || formValues.title,
          sortOrder: selectedSlot ? 0 : items.length,
          status: "published",
        },
        options: {
          onProgress: (progress) => setUploadProgress(progress.percent),
        },
      })
      toast.success("Gallery image uploaded.")
      setSelectedFile(null)
      setUploadProgress(null)
      await galleryQuery.refetch()
      setFormValues({
        title: "",
        description: "",
        category: "hostel",
        altText: "",
      })
      setSelectedSlot(null)
      setUploadOpen(false)
    } catch (error) {
      setUploadProgress(null)
      toast.error(error instanceof Error ? error.message : "Gallery image could not be uploaded.")
    }
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
          value={new Set(items.map((item) => item.category)).size}
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
          <CardTitle>Public website image slots</CardTitle>
          <CardDescription>
            Upload or replace each public-facing photo from one place. Each slot shows where the
            image appears so the public website is easy to maintain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {gallerySlots.map((slot) => {
              const slotItem = findGallerySlotItem(items, slot)
              const previewUrl = slotItem?.imageUrl ?? slot.fallbackImage

              return (
                <article
                  key={slot.id}
                  className="grid overflow-hidden rounded-xl border bg-background shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-video bg-muted">
                    {slot.id === "logo" ? (
                      <div className="grid size-full place-items-center bg-gradient-to-br from-primary/10 via-muted to-muted">
                        <BrandMark
                          logoUrl={slotItem?.imageUrl}
                          className="size-20 rounded-2xl text-2xl"
                        />
                      </div>
                    ) : previewUrl ? (
                      <div
                        role="img"
                        aria-label={slotItem?.alt_text ?? slot.defaultAlt}
                        className="size-full bg-cover bg-center"
                        style={{ backgroundImage: `url("${previewUrl}")` }}
                      />
                    ) : (
                      <div className="grid size-full place-items-center">
                        <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
                      {slotItem ? "Uploaded" : "Fallback"}
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
                    {slotItem ? (
                      <p className="text-xs text-muted-foreground">
                        Current: <span className="font-medium text-foreground">{slotItem.title}</span>{" "}
                        · {formatGalleryCategory(slotItem.category)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Upload with category <code>{slot.category}</code> to replace this slot.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant={slotItem ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                      onClick={() => openSlotUpload(slot)}
                    >
                      <UploadCloud className="size-3.5" aria-hidden="true" />
                      {slotItem ? "Replace image" : "Upload image"}
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
            Published uploads here feed the public logo, hero, room previews, gallery page, and
            homepage gallery. Upload your logo with category <code>logo</code>. If no gallery records exist,
            the site uses the local fallback photos below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <div className="rounded-xl border bg-success-surface p-4 text-sm text-success-foreground">
              Public pages are currently using {items.filter((item) => item.status === "published").length} published admin-uploaded photo(s). Logo records are detected by category <code>logo</code>.
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
                    {selectedSlot ? `Upload ${selectedSlot.title}` : "Upload Gallery Image"}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedSlot
                      ? `This image will update: ${selectedSlot.visibleIn.join(", ")}.`
                      : "Add a public hostel photo. JPG, PNG, and WebP images up to 6 MB are accepted."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="gallery-file">Image</Label>
                    <Input
                      id="gallery-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gallery-title">Title</Label>
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
                    Publish image
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
                        <StatusBadge status={item.status} />
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
