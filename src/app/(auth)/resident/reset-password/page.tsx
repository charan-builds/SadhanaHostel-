import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { ResidentPasswordResetRequestForm } from "@/components/auth/resident-password-reset-request-form"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { pickBrandLogo } from "@/lib/public-gallery"

export const metadata: Metadata = {
  title: "Resident Password Reset",
  description: "Request a temporary resident portal password from hostel administration.",
}

export default async function ResidentPasswordResetPage() {
  const cms = await getPublicCmsContent()

  return (
    <AuthShell
      title="Request password reset"
      description="Enter your registered phone number. Admin will verify the request before issuing temporary access."
      logoUrl={pickBrandLogo(cms.galleryItems)}
    >
      <ResidentPasswordResetRequestForm />
    </AuthShell>
  )
}
