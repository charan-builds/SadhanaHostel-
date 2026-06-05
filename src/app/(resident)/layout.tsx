import type { ReactNode } from "react"
import type { Metadata } from "next"

import { PasswordResetGate } from "@/components/auth/password-reset-gate"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { SessionProviders } from "@/components/providers/app-providers"
import { residentNavigation } from "@/constants/navigation"
import { requireProtectedRoute } from "@/lib/auth/server-route-guard"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { getPublishedBrandLogoUrl } from "@/lib/public-brand-logo"
import { pickBrandLogo } from "@/lib/public-gallery"
import { noIndexMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const metadata: Metadata = noIndexMetadata

export default async function ResidentLayout({ children }: { children: ReactNode }) {
  await requireProtectedRoute("resident")
  const [cms, settingsLogoUrl] = await Promise.all([
    getPublicCmsContent(),
    getPublishedBrandLogoUrl(),
  ])
  const logoUrl = settingsLogoUrl ?? pickBrandLogo(cms.galleryItems)

  return (
    <SessionProviders>
      <DashboardShell
        area="resident"
        title="Resident Portal"
        description="View profile details, fee status, leave requests, and hostel notices."
        navigation={residentNavigation}
        logoUrl={logoUrl}
      >
        <PasswordResetGate area="resident">{children}</PasswordResetGate>
      </DashboardShell>
    </SessionProviders>
  )
}
