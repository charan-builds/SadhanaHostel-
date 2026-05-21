"use client"

import { ImageIcon } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { useGallery } from "@/hooks"

export function AdminGalleryClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const galleryQuery = useGallery({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 50,
  })

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization not linked"
        message="Your admin account must be linked before gallery assets can be managed."
      />
    )
  }

  const items = galleryQuery.data?.data ?? []

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
        <CardHeader>
          <CardTitle>Gallery</CardTitle>
          <CardDescription>
            Review CMS gallery records that feed the public gallery page.
          </CardDescription>
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
              title="No gallery records found"
              message="Upload gallery images through the secured upload pipeline, then create gallery CMS records."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-lg border">
                  <div className="flex aspect-video items-center justify-center bg-muted">
                    <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                  </div>
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
