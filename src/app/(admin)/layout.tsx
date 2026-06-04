import type { ReactNode } from "react"
import type { Metadata } from "next"

import { AdminLayoutShell } from "@/components/admin/layout/admin-layout-shell"
import { PasswordResetGate } from "@/components/auth/password-reset-gate"
import { SessionProviders } from "@/components/providers/app-providers"
import { requireProtectedRoute } from "@/lib/auth/server-route-guard"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { pickBrandLogo } from "@/lib/public-gallery"
import { noIndexMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const metadata: Metadata = noIndexMetadata

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireProtectedRoute("admin")
  const cms = await getPublicCmsContent()

  return (
    <SessionProviders>
      <AdminLayoutShell logoUrl={pickBrandLogo(cms.galleryItems)}>
        <PasswordResetGate area="admin">{children}</PasswordResetGate>
      </AdminLayoutShell>
    </SessionProviders>
  )
}
