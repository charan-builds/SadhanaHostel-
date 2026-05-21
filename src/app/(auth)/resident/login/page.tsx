import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { GlobalLoader } from "@/components/system"

export const metadata: Metadata = {
  title: "Resident Login",
  description: "Sign in to the Sadhana Boys Hostel resident portal.",
}

export default function ResidentLoginPage() {
  return (
    <AuthShell
      title="Resident portal"
      description="Access fee status, invoices, leave requests, notices, and profile updates."
    >
      <Suspense fallback={<GlobalLoader label="Loading resident login..." />}>
        <LoginForm expectedArea="resident" />
      </Suspense>
    </AuthShell>
  )
}
