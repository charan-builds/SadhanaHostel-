import type { Metadata } from "next"

import { SupportCenterContent } from "@/components/support/support-center-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const supportDescription =
  `Get help with resident login, onboarding, payments, uploads, invites, and account access at ${hostelConfig.name} in Pulivendula.`

export const metadata: Metadata = createPublicMetadata({
  title: `Support ${hostelConfig.name} Pulivendula`,
  description: supportDescription,
  path: "/support",
  keywords: [
    "Sadhana Boys Hostel support",
    "hostel resident support Pulivendula",
    "Pulivendula hostel login help",
  ],
})

export default function SupportPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: `${hostelConfig.name} Pulivendula support center`,
          description: supportDescription,
          path: "/support",
        })}
      />
      <SupportCenterContent />
    </>
  )
}
