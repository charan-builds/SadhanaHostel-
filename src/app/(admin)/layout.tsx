import type { ReactNode } from "react"
import type { Metadata } from "next"

import { AdminLayoutShell } from "@/components/admin/layout/admin-layout-shell"
import { PasswordResetGate } from "@/components/auth/password-reset-gate"
import { SessionProviders } from "@/components/providers/app-providers"
import { requireProtectedRoute } from "@/lib/auth/server-route-guard"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { getPublishedBrandLogoUrl } from "@/lib/public-brand-logo"
import { pickBrandLogo } from "@/lib/public-gallery"
import { noIndexMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const metadata: Metadata = noIndexMetadata

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireProtectedRoute("admin")
  const [cms, settingsLogoUrl] = await Promise.all([
    getPublicCmsContent(),
    getPublishedBrandLogoUrl(),
  ])
  const logoUrl = settingsLogoUrl ?? pickBrandLogo(cms.galleryItems)

  return (
    <SessionProviders>
      <AdminLayoutShell logoUrl={logoUrl}>
        <PasswordResetGate area="admin">{children}</PasswordResetGate>
      </AdminLayoutShell>
    </SessionProviders>
  )
}
