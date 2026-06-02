import type { Metadata } from "next"

import { AboutPageContent } from "@/components/public/about-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const aboutDescription = `${hostelConfig.name} offers safe, clean boys hostel accommodation for students and employees in Pulivendula on ${hostelConfig.location.note}.`

export const metadata: Metadata = createPublicMetadata({
  title: `About ${hostelConfig.name} in Pulivendula`,
  description: aboutDescription,
  path: "/about",
  keywords: ["about Sadhana Boys Hostel", "safe boys hostel Pulivendula"],
})

export default async function AboutPage() {
  const cms = await getPublicCmsContent()

  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: `About ${hostelConfig.name}`,
          description: aboutDescription,
          path: "/about",
          pageType: "AboutPage",
          image: "/images/hostel-exterior-wide.webp",
        })}
      />
      <AboutPageContent aboutText={cms.aboutText} />
    </>
  )
}
