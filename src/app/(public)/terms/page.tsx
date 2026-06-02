import type { Metadata } from "next"

import { TermsPageContent } from "@/components/public/terms-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const termsDescription = `Read hostel rules, resident terms, and stay conditions for students and employees at ${hostelConfig.name} in Pulivendula.`

export const metadata: Metadata = createPublicMetadata({
  title: `Hostel Rules and Terms | ${hostelConfig.name}`,
  description: termsDescription,
  path: "/terms",
  keywords: ["Sadhana Boys Hostel rules", "Pulivendula hostel terms"],
})

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: `${hostelConfig.name} rules and terms`,
          description: termsDescription,
          path: "/terms",
        })}
      />
      <TermsPageContent />
    </>
  )
}
