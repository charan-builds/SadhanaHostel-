import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { GlobalLoader } from "@/components/system"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { pickBrandLogo } from "@/lib/public-gallery"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Sadhana Boys Hostel.",
}

export default async function LoginPage() {
  const cms = await getPublicCmsContent()

  return (
    <AuthShell
      title="Sign in"
      description="Use your admin, staff, or resident credentials to continue."
      logoUrl={pickBrandLogo(cms.galleryItems)}
    >
      <Suspense fallback={<GlobalLoader label="Loading login..." />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
