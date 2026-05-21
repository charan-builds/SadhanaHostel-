import type { Metadata } from "next"

import { GalleryPageContent } from "@/components/public/gallery-page-content"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"

export const metadata: Metadata = {
  title: `Gallery | ${hostelConfig.name}`,
  description: `View hostel gallery media for ${hostelConfig.name} in Pulivendula, including exterior, rooms, dining, and terrace spaces.`,
}

export default async function GalleryPage() {
  const cms = await getPublicCmsContent()

  return <GalleryPageContent galleryItems={cms.galleryItems} />
}
