import type { ReactNode } from "react"

import { PasswordResetGate } from "@/components/auth/password-reset-gate"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { SessionProviders } from "@/components/providers/app-providers"
import { residentNavigation } from "@/constants/navigation"
import { requireProtectedRoute } from "@/lib/auth/server-route-guard"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function ResidentLayout({ children }: { children: ReactNode }) {
  await requireProtectedRoute("resident")

  return (
    <SessionProviders>
      <DashboardShell
        area="resident"
        title="Resident Portal"
        description="View profile details, fee status, leave requests, and hostel notices."
        navigation={residentNavigation}
      >
        <PasswordResetGate area="resident">{children}</PasswordResetGate>
      </DashboardShell>
    </SessionProviders>
  )
}
