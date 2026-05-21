import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your Sadhana Boys Hostel account password.",
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      description="Enter your account email and we will send secure reset instructions."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
