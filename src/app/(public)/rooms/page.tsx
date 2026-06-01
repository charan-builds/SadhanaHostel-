import type { Metadata } from "next"

import { RoomsPageContent } from "@/components/public/rooms-page-content"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"

export const metadata: Metadata = {
  title: `Rooms and Pricing | ${hostelConfig.name}`,
  description: `Rooms for students and employees at ${hostelConfig.name} in Pulivendula with clear monthly pricing.`,
}

export default async function RoomsPage() {
  const cms = await getPublicCmsContent()

  return <RoomsPageContent roomTypes={cms.roomTypes} galleryItems={cms.galleryItems} />
}
