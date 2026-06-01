import type { Metadata } from "next"

import { ContactPageContent } from "@/components/public/contact-page-content"
import { hostelConfig } from "@/constants/hostel"

export const metadata: Metadata = {
  title: `Contact ${hostelConfig.name}`,
  description: `Contact ${hostelConfig.name} in Pulivendula by phone or WhatsApp and get directions to ${hostelConfig.location.note}.`,
}

export default function ContactPage() {
  return <ContactPageContent />
}
