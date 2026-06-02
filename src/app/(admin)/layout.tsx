import type { ReactNode } from "react"
import type { Metadata } from "next"

import { AdminLayoutShell } from "@/components/admin/layout/admin-layout-shell"
import { PasswordResetGate } from "@/components/auth/password-reset-gate"
import { SessionProviders } from "@/components/providers/app-providers"
import { requireProtectedRoute } from "@/lib/auth/server-route-guard"
import { noIndexMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const metadata: Metadata = noIndexMetadata

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireProtectedRoute("admin")

  return (
    <SessionProviders>
      <AdminLayoutShell>
        <PasswordResetGate area="admin">{children}</PasswordResetGate>
      </AdminLayoutShell>
    </SessionProviders>
  )
}
