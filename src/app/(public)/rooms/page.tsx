import type { Metadata } from "next"

import { RoomsPageContent } from "@/components/public/rooms-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import {
  createFaqJsonLd,
  createPublicMetadata,
  createPublicPageJsonLd,
  createRoomsOfferCatalogJsonLd,
} from "@/lib/seo"

const roomsDescription = `Compare boys hostel rooms at ${hostelConfig.name}: student rooms at ₹${hostelConfig.fees.student}/month and employee accommodation at ₹${hostelConfig.fees.employee}/month with food, WiFi, CCTV, water, and parking support.`

const roomsFaqItems = [
  {
    question: "What room options are available at Sadhana Boys Hostel?",
    answer: `Student hostel rooms and employee hostel accommodation are available at ${hostelConfig.name}.`,
  },
  {
    question: "What is the student room fee?",
    answer: `Student hostel rooms are ₹${hostelConfig.fees.student}/month.`,
  },
  {
    question: "What is the employee accommodation fee?",
    answer: `Employee accommodation is ₹${hostelConfig.fees.employee}/month.`,
  },
] as const

export const metadata: Metadata = createPublicMetadata({
  title: `Boys Hostel Rooms | ${hostelConfig.name}`,
  description: roomsDescription,
  path: "/rooms",
  keywords: [
    "boys hostel rooms Tirupati",
    "student hostel rooms Tirupati",
    "hostel room fees Tirupati",
    "boys hostel rooms Pulivendula",
  ],
})

export default async function RoomsPage() {
  const cms = await getPublicCmsContent()

  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: `${hostelConfig.name} rooms`,
          description: roomsDescription,
          path: "/rooms",
          image: "/images/hostel-courtyard-clean.webp",
        })}
      />
      <JsonLd data={createRoomsOfferCatalogJsonLd()} />
      <JsonLd data={createFaqJsonLd(roomsFaqItems)} />
      <RoomsPageContent roomTypes={cms.roomTypes} galleryItems={cms.galleryItems} />
    </>
  )
}
