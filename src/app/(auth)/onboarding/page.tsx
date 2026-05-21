import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { OnboardingClient } from "@/components/auth/onboarding-client"

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Complete resident onboarding and upload required hostel documents.",
}

export default function OnboardingPage() {
  return (
    <AuthShell
      title="Complete onboarding"
      description="Review your resident contact details and upload required identity documents."
    >
      <OnboardingClient />
    </AuthShell>
  )
}
