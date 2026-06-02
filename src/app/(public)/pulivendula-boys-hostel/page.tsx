import type { Metadata } from "next"

import { PulivendulaHostelPageContent } from "@/components/public/pulivendula-hostel-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import {
  createHomeFaqJsonLd,
  createPublicMetadata,
  createPublicPageJsonLd,
  createRoomsOfferCatalogJsonLd,
} from "@/lib/seo"

const pageDescription = `${hostelConfig.name} is a boys hostel in Pulivendula for students and employees with student rooms at ₹${hostelConfig.fees.student}/month, employee accommodation at ₹${hostelConfig.fees.employee}/month, food, WiFi, CCTV, water, and parking.`

export const metadata: Metadata = createPublicMetadata({
  title: `Boys Hostel in Pulivendula | ${hostelConfig.name}`,
  description: pageDescription,
  path: "/pulivendula-boys-hostel",
  keywords: [
    "boys hostel Pulivendula",
    "best hostel in Pulivendula",
    "student hostel Pulivendula",
    "employee hostel Pulivendula",
    "hostel near Royals Road Pulivendula",
    "hostel near Bakarapuram Pulivendula",
  ],
  image: "/images/hostel-exterior-wide.webp",
})

export default function PulivendulaBoysHostelPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Boys hostel in Pulivendula",
          description: pageDescription,
          path: "/pulivendula-boys-hostel",
          image: "/images/hostel-exterior-wide.webp",
        })}
      />
      <JsonLd data={createRoomsOfferCatalogJsonLd()} />
      <JsonLd data={createHomeFaqJsonLd()} />
      <PulivendulaHostelPageContent />
    </>
  )
}
