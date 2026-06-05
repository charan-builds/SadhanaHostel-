import type { Metadata } from "next"

import { FacilitiesPageContent } from "@/components/public/facilities-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const facilitiesDescription = `Facilities at ${hostelConfig.name} in Pulivendula include food, WiFi, CCTV, water facilities, parking support, and clean hostel spaces.`

export const metadata: Metadata = createPublicMetadata({
  title: `Hostel Facilities in Pulivendula | ${hostelConfig.name}`,
  description: facilitiesDescription,
  path: "/facilities",
  keywords: ["hostel with food Pulivendula", "hostel WiFi CCTV Pulivendula"],
})

export default async function FacilitiesPage() {
  const cms = await getPublicCmsContent()

  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Hostel facilities in Pulivendula",
          description: facilitiesDescription,
          path: "/facilities",
          image: "/images/hostel-courtyard-clean.webp",
        })}
      />
      <FacilitiesPageContent facilities={cms.facilities} galleryItems={cms.galleryItems} />
    </>
  )
}
