import { ResidentOnboardingClient } from "@/components/resident/onboarding/resident-onboarding-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default function ResidentOnboardingPage() {
  return <ResidentOnboardingClient />
}
