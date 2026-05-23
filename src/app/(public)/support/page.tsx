import type { Metadata } from "next"

import { SupportCenterContent } from "@/components/support/support-center-content"

export const metadata: Metadata = {
  title: "Support Center",
  description:
    "Operational recovery support for onboarding, payments, uploads, invites, and account access at Sadhana Boys Hostel.",
}

export default function SupportPage() {
  return <SupportCenterContent />
}
