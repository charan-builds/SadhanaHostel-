import { GalleryHorizontalEnd } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"

export default function AdminGalleryPage() {
  return (
    <>
      <PageHeader
        title="Gallery"
        description="Manage public website gallery assets and categories from the admin panel."
        badge="Frontend placeholder"
      />
      <EmptyState
        icon={GalleryHorizontalEnd}
        title="Gallery management is ready for UI work"
        description="Upload and media-management logic will be connected later through approved backend flows."
      />
    </>
  )
}
