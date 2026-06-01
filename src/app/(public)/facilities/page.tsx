import type { Metadata } from "next"

import { FacilitiesPageContent } from "@/components/public/facilities-page-content"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"

export const metadata: Metadata = {
  title: `Facilities | ${hostelConfig.name}`,
  description: `Facilities at ${hostelConfig.name} in Pulivendula include food, WiFi, CCTV, water, parking, and clean hostel spaces.`,
}

export default async function FacilitiesPage() {
  const cms = await getPublicCmsContent()

  return <FacilitiesPageContent facilities={cms.facilities} galleryItems={cms.galleryItems} />
}
