import type { Metadata } from "next"

import { ContactPageContent } from "@/components/public/contact-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const contactDescription = `Call or WhatsApp ${hostelConfig.name} in Pulivendula for joining details, student accommodation, employee accommodation, and directions to ${hostelConfig.location.note}.`

export const metadata: Metadata = createPublicMetadata({
  title: `Contact ${hostelConfig.name} Pulivendula`,
  description: contactDescription,
  path: "/contact",
  keywords: ["Sadhana Boys Hostel contact", "Pulivendula hostel phone number"],
})

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: `Contact ${hostelConfig.name}`,
          description: contactDescription,
          path: "/contact",
          pageType: "ContactPage",
          image: "/images/hostel-gate.webp",
        })}
      />
      <ContactPageContent />
    </>
  )
}
