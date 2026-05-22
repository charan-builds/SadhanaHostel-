import type { Metadata } from "next"
import { Suspense } from "react"

import { ActivationClient } from "@/components/auth/activation-client"
import { AuthShell } from "@/components/auth/auth-shell"
import { GlobalLoader } from "@/components/system"

export const metadata: Metadata = {
  title: "Activate Resident Account",
  description: "Activate your Sadhana Boys Hostel resident portal invite.",
}

export default function ActivatePage() {
  return (
    <AuthShell
      title="Activate resident access"
      description="Resident portal access is issued by hostel administration after admission approval."
    >
      <Suspense fallback={<GlobalLoader label="Loading activation..." />}>
        <ActivationClient />
      </Suspense>
    </AuthShell>
  )
}
