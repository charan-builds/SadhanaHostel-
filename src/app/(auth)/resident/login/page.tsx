import type { Metadata } from "next"
import type { Route } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { GlobalLoader } from "@/components/system"
import { Button } from "@/components/ui/button"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { getPublishedBrandLogoUrl } from "@/lib/public-brand-logo"
import { pickBrandLogo } from "@/lib/public-gallery"

export const metadata: Metadata = {
  title: "Resident Login",
  description: "Sign in to the Sadhana Boys Hostel resident portal.",
}

export default async function ResidentLoginPage() {
  const [cms, settingsLogoUrl] = await Promise.all([
    getPublicCmsContent(),
    getPublishedBrandLogoUrl(),
  ])
  const logoUrl = settingsLogoUrl ?? pickBrandLogo(cms.galleryItems)

  return (
    <AuthShell
      title="Resident Portal"
      portalLabel="Resident Portal"
      description="Use your phone number and temporary password, or an invite link, to access resident services."
      logoUrl={logoUrl}
    >
      <Suspense fallback={<GlobalLoader label="Loading resident login..." />}>
        <LoginForm expectedArea="resident" />
      </Suspense>
      <div className="mt-6 rounded-lg border bg-muted/30 p-4">
        <h2 className="text-sm font-semibold">Need hostel access?</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Resident accounts are created by hostel administration. If you were admitted recently,
          use the WhatsApp activation link, invite code, or temporary password shared by the office.
          Email can be added later from your resident profile.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" size="sm">
            <Link href={"/activate" as Route}>Use invite code</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`https://wa.me/${hostelConfig.contact.whatsapp.replace(/\D/g, "")}`}>
              WhatsApp admin
            </a>
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
