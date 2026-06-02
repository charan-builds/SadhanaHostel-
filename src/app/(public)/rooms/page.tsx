import type { Metadata } from "next"

import { RoomsPageContent } from "@/components/public/rooms-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import { createPublicMetadata, createPublicPageJsonLd, createRoomsOfferCatalogJsonLd } from "@/lib/seo"

const roomsDescription = `Student hostel rooms at ₹${hostelConfig.fees.student}/month and employee accommodation at ₹${hostelConfig.fees.employee}/month at ${hostelConfig.name} in Pulivendula.`

export const metadata: Metadata = createPublicMetadata({
  title: `Rooms and Fees in Pulivendula | ${hostelConfig.name}`,
  description: roomsDescription,
  path: "/rooms",
  keywords: [
    "hostel rooms Pulivendula",
    "student hostel fee Pulivendula",
    "employee hostel fee Pulivendula",
    "3500 hostel Pulivendula",
  ],
})

export default async function RoomsPage() {
  const cms = await getPublicCmsContent()

  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Rooms and fees in Pulivendula",
          description: roomsDescription,
          path: "/rooms",
          image: "/images/image copy.png",
        })}
      />
      <JsonLd data={createRoomsOfferCatalogJsonLd()} />
      <RoomsPageContent roomTypes={cms.roomTypes} galleryItems={cms.galleryItems} />
    </>
  )
}
