import type { ReactNode } from "react"

import { AdminLayoutShell } from "@/components/admin/layout/admin-layout-shell"
import { SessionProviders } from "@/components/providers/app-providers"
import { requireProtectedRoute } from "@/lib/auth/server-route-guard"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireProtectedRoute("admin")

  return (
    <SessionProviders>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </SessionProviders>
  )
}
