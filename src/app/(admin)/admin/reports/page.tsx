import { BarChart3 } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"

export default function AdminReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Review occupancy, payments, leaves, and resident activity reports."
        badge="Frontend placeholder"
      />
      <EmptyState
        icon={BarChart3}
        title="Reports dashboard is not connected yet"
        description="Charts and exports can be added after the admin data views are finalized."
      />
    </>
  )
}
