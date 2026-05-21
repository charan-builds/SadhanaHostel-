import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { GlobalLoader } from "@/components/system"

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to the Sadhana Boys Hostel admin dashboard or resident portal.",
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      description="Use your hostel account to access the admin dashboard or resident portal."
    >
      <Suspense fallback={<GlobalLoader label="Loading sign in..." />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
