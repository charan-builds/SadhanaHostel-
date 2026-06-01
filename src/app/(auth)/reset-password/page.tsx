import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordClient } from "@/components/auth/reset-password-client"

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your Sadhana Boys Hostel account.",
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set new password"
      description="Complete the secure recovery step and return to your portal."
    >
      <ResetPasswordClient />
    </AuthShell>
  )
}
