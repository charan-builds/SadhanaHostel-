import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { OnboardingClient } from "@/components/auth/onboarding-client"

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Complete resident onboarding profile details.",
}

export default function OnboardingPage() {
  return (
    <AuthShell
      title="Complete onboarding"
      description="Review your resident contact, father phone, and mother phone."
    >
      <OnboardingClient />
    </AuthShell>
  )
}
