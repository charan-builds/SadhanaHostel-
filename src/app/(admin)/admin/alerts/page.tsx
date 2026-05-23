import type { Metadata } from "next"

import { AdminOperationalAlertsClient } from "@/components/admin/support/admin-operational-alerts-client"

export const metadata: Metadata = {
  title: "Operational Alerts",
}

export default function AdminOperationalAlertsPage() {
  return <AdminOperationalAlertsClient />
}
