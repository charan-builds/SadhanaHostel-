import type { Metadata } from "next"
import { Suspense } from "react"

import { ActivationClient } from "@/components/auth/activation-client"
import { AuthShell } from "@/components/auth/auth-shell"
import { GlobalLoader } from "@/components/system"

export const metadata: Metadata = {
  title: "Activate Resident Account",
  description: "Set your resident portal password from a secure hostel invite.",
}

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function ActivateTokenPage({ params }: PageProps) {
  const { token } = await params

  return (
    <AuthShell
      title="Activate resident access"
      description="Verify your invite and create a password for the resident portal."
    >
      <Suspense fallback={<GlobalLoader label="Validating invite..." />}>
        <ActivationClient initialToken={token} />
      </Suspense>
    </AuthShell>
  )
}
