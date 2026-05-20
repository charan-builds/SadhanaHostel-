import type { Metadata } from "next"

import { TermsPageContent } from "@/components/public/terms-page-content"
import { hostelConfig } from "@/constants/hostel"

export const metadata: Metadata = {
  title: `Terms and Conditions | ${hostelConfig.name}`,
  description: `Read hostel rules and terms for residents staying at ${hostelConfig.name} in Pulivendula.`,
}

export default function TermsPage() {
  return <TermsPageContent />
}
