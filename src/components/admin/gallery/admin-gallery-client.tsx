"use client"

import { ImageIcon, Loader2, UploadCloud } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { useGallery, useUploadGalleryImage } from "@/hooks"

export function AdminGalleryClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [formValues, setFormValues] = useState({
    title: "",
    description: "",
    category: "hostel",
    altText: "",
  })
  const galleryQuery = useGallery({
    organizationId: organizationId ?? "",
    hostelId,
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

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!organizationId) {
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
          organizationId,
          hostelId,
          title: formValues.title,
          description: formValues.description || undefined,
          category: formValues.category || "hostel",
          altText: formValues.altText || formValues.title,
          sortOrder: items.length,
          status: "published",
        },
        options: {
          onProgress: (progress) => setUploadProgress(progress.percent),
        },
      })
      toast.success("Gallery image uploaded.")
      setSelectedFile(null)
      setUploadProgress(null)
      setFormValues({
        title: "",
        description: "",
        category: "hostel",
        altText: "",
      })
      setUploadOpen(false)
    } catch {
      setUploadProgress(null)
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

      <Card>
        <CardHeader className="gap-3 md:grid md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Gallery</CardTitle>
            <CardDescription>
              Upload, publish, and preview hostel gallery images from the admin panel.
            </CardDescription>
          </div>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UploadCloud className="size-4" />
                Upload images
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleUpload}>
                <DialogHeader>
                  <DialogTitle>Upload Gallery Image</DialogTitle>
                  <DialogDescription>
                    Add a public hostel photo. JPG, PNG, and WebP images up to 6 MB are accepted.
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
                      <Input
                        id="gallery-category"
                        value={formValues.category}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                      />
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
              action={<Button onClick={() => setUploadOpen(true)}>Upload images</Button>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
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
                  <div className="grid gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold">{item.title}</h2>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.published_at
                        ? `Published ${formatDateTime(item.published_at)}`
                        : "Not published"}
                    </p>
                  </div>
                </article>
              ))}
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
