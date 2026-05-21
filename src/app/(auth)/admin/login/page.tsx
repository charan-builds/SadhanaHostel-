import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { GlobalLoader } from "@/components/system"

export const metadata: Metadata = {
  title: "Admin Login",
  description: "Sign in to the Sadhana Boys Hostel admin ERP dashboard.",
}

export default function AdminLoginPage() {
  return (
    <AuthShell
      title="Admin portal"
      description="Secure access for hostel owners, admins, and authorized staff."
    >
      <Suspense fallback={<GlobalLoader label="Loading admin login..." />}>
        <LoginForm expectedArea="admin" />
      </Suspense>
    </AuthShell>
  )
}
