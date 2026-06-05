import type { Metadata } from "next"

import { TirupatiSeoLandingPageContent } from "@/components/public/tirupati-seo-landing-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { createFaqJsonLd, createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const description = `Student accommodation search page for Tirupati: compare monthly boys hostel fees, facilities, food, WiFi, CCTV, water, rules, and admission steps with ${hostelConfig.name}.`

const faqItems = [
  {
    question: "What is the listed student accommodation fee?",
    answer: `Student accommodation is listed from ₹${hostelConfig.fees.student}/month.`,
  },
  {
    question: "Can parents call before visiting?",
    answer: "Yes. Parents can call or WhatsApp to ask about rooms, facilities, rules, monthly fees, and joining process.",
  },
  {
    question: "What should students check before joining?",
    answer: "Check food, WiFi, water, CCTV, room setup, location, fees, and hostel rules.",
  },
] as const

export const metadata: Metadata = createPublicMetadata({
  title: `Student Accommodation in Tirupati | Boys Hostel Rooms`,
  description,
  path: "/student-accommodation-tirupati",
  keywords: [
    "student accommodation Tirupati",
    "student hostel in Tirupati",
    "boys student accommodation Tirupati",
    "affordable student hostel Tirupati",
  ],
})

export default function StudentAccommodationTirupatiPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Student accommodation in Tirupati",
          description,
          path: "/student-accommodation-tirupati",
          image: "/images/hostel-exterior-wide.webp",
        })}
      />
      <JsonLd data={createFaqJsonLd(faqItems)} />
      <TirupatiSeoLandingPageContent
        eyebrow="Student accommodation Tirupati"
        title="Student accommodation search page for Tirupati families."
        description={description}
        intentCards={[
          {
            title: "Student monthly fee",
            description: `Student hostel rooms are listed from ₹${hostelConfig.fees.student}/month.`,
          },
          {
            title: "Parent-friendly contact",
            description: "Call or WhatsApp before visiting to clarify stay details.",
          },
          {
            title: "Facilities to verify",
            description: "Food, WiFi, CCTV, water, rooms, parking, and rules can be confirmed before admission.",
          },
        ]}
        faqItems={[...faqItems]}
      />
    </>
  )
}
