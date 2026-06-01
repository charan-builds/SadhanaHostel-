import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { GlobalLoader } from "@/components/system"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { pickBrandLogo } from "@/lib/public-gallery"

export const metadata: Metadata = {
  title: "Admin Login",
  description: "Sign in to the Sadhana Boys Hostel admin ERP dashboard.",
}

export default async function AdminLoginPage() {
  const cms = await getPublicCmsContent()

  return (
    <AuthShell
      title="Admin portal"
      description="Secure access for hostel owners, admins, and authorized staff."
      logoUrl={pickBrandLogo(cms.galleryItems)}
    >
      <Suspense fallback={<GlobalLoader label="Loading admin login..." />}>
        <LoginForm expectedArea="admin" />
      </Suspense>
    </AuthShell>
  )
}
