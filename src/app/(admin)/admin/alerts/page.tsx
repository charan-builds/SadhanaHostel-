import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminOperationalAlertsClient } from "@/components/admin/support/admin-operational-alerts-client"
import { GlobalLoader } from "@/components/system"

export const metadata: Metadata = {
  title: "Operational Alerts",
}

export default function AdminOperationalAlertsPage() {
  return (
    <Suspense fallback={<GlobalLoader label="Loading operational alerts..." />}>
      <AdminOperationalAlertsClient />
    </Suspense>
  )
}
