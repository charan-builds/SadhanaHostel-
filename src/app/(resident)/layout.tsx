import type { ReactNode } from "react"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { residentNavigation } from "@/constants/navigation"
import { RouteGuard } from "@/lib/auth"

export default function ResidentLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard area="resident">
      <DashboardShell
        area="resident"
        title="Resident Portal"
        description="View profile details, fee status, leave requests, and hostel notices."
        navigation={residentNavigation}
      >
        {children}
      </DashboardShell>
    </RouteGuard>
  )
}
