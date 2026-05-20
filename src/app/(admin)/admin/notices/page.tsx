import { ClipboardList } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"

export default function AdminNoticesPage() {
  return (
    <>
      <PageHeader
        title="Notices"
        description="Create and manage hostel notices for residents. This frontend page is ready for the notices workflow."
        badge="Frontend placeholder"
      />
      <EmptyState
        icon={ClipboardList}
        title="No notices connected yet"
        description="Notice publishing UI will be added here without touching backend routes."
      />
    </>
  )
}
