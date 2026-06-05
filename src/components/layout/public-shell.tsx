import type { ReactNode } from "react"

import { PublicFooter } from "@/components/public/public-footer"
import { PublicNavbar } from "@/components/public/public-navbar"
import { RouteTransition } from "@/components/shared/route-transition"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { getPublishedBrandLogoUrl } from "@/lib/public-brand-logo"
import { pickBrandLogo } from "@/lib/public-gallery"

export async function PublicShell({ children }: { children: ReactNode }) {
  const [cms, settingsLogoUrl] = await Promise.all([
    getPublicCmsContent(),
    getPublishedBrandLogoUrl(),
  ])
  const logoUrl = settingsLogoUrl ?? pickBrandLogo(cms.galleryItems)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicNavbar logoUrl={logoUrl} />
      <div className="flex flex-1 flex-col">
        <RouteTransition className="flex flex-1 flex-col">{children}</RouteTransition>
      </div>
      <PublicFooter logoUrl={logoUrl} />
    </div>
  )
}
