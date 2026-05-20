import type { ReactNode } from "react"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { residentNavigation } from "@/constants/navigation"

export default function ResidentLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell
      area="resident"
      title="Resident Portal"
      description="View profile details, fee status, leave requests, and hostel notices."
      navigation={residentNavigation}
    >
      {children}
    </DashboardShell>
  )
}
