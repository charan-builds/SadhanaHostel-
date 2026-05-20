import type { ReactNode } from "react"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { adminNavigation } from "@/constants/navigation"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell
      area="admin"
      title="Hostel Operations"
      description="Manage residents, rooms, payments, leaves, notices, and website content."
      navigation={adminNavigation}
    >
      {children}
    </DashboardShell>
  )
}
