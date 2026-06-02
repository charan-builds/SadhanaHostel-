import type { Metadata } from "next"

import { GalleryPageContent } from "@/components/public/gallery-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const galleryDescription = `View photos of ${hostelConfig.name} in Pulivendula, including hostel exterior, room views, dining, facilities, and common spaces.`

export const metadata: Metadata = createPublicMetadata({
  title: `Hostel Photos in Pulivendula | ${hostelConfig.name} Gallery`,
  description: galleryDescription,
  path: "/gallery",
  keywords: ["Sadhana Boys Hostel photos", "Pulivendula hostel gallery"],
})

export default async function GalleryPage() {
  const cms = await getPublicCmsContent()

  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: `${hostelConfig.name} gallery`,
          description: galleryDescription,
          path: "/gallery",
          pageType: "CollectionPage",
          image: "/images/hostel-exterior-wide.webp",
        })}
      />
      <GalleryPageContent galleryItems={cms.galleryItems} />
    </>
  )
}
