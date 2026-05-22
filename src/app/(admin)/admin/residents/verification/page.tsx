import { AdminOnboardingVerificationClient } from "@/components/admin/residents/verification/admin-onboarding-verification-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default function AdminResidentVerificationPage() {
  return <AdminOnboardingVerificationClient />
}
