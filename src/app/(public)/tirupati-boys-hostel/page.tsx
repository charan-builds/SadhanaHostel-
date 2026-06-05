import type { Metadata } from "next"

import { TirupatiSeoLandingPageContent } from "@/components/public/tirupati-seo-landing-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { createFaqJsonLd, createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const description = `${hostelConfig.name} helps students and families searching for boys hostel options in Tirupati compare monthly fees, rooms, facilities, admission steps, and contact details before visiting.`

const faqItems = [
  {
    question: "Can Tirupati students contact Sadhana Boys Hostel?",
    answer: "Yes. Students and families searching from Tirupati can call or WhatsApp to confirm rooms, fees, and admission details before visiting.",
  },
  {
    question: "What monthly fee should students expect?",
    answer: `Student hostel rooms are listed from ₹${hostelConfig.fees.student}/month, subject to current room availability and hostel policy.`,
  },
  {
    question: "What facilities can I ask about before visiting?",
    answer: "Ask about food, WiFi, CCTV, water facilities, parking, rooms, and joining process.",
  },
] as const

export const metadata: Metadata = createPublicMetadata({
  title: `Boys Hostel in Tirupati | ${hostelConfig.name}`,
  description,
  path: "/tirupati-boys-hostel",
  keywords: [
    "boys hostel in Tirupati",
    "Tirupati boys hostel",
    "best boys hostel in Tirupati",
    "affordable boys hostel Tirupati",
  ],
})

export default function TirupatiBoysHostelPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Boys hostel in Tirupati",
          description,
          path: "/tirupati-boys-hostel",
          image: "/images/hostel-exterior-wide.webp",
        })}
      />
      <JsonLd data={createFaqJsonLd(faqItems)} />
      <TirupatiSeoLandingPageContent
        eyebrow="Boys hostel in Tirupati"
        title="Boys hostel search page for Tirupati students and families."
        description={description}
        intentCards={[
          {
            title: "Clear monthly fees",
            description: `Student rooms from ₹${hostelConfig.fees.student}/month and employee accommodation from ₹${hostelConfig.fees.employee}/month.`,
          },
          {
            title: "Call before visiting",
            description: "Confirm room availability, rules, and joining process before travel.",
          },
          {
            title: "Facilities checklist",
            description: "Food, WiFi, CCTV, water facilities, parking support, and practical room options.",
          },
        ]}
        faqItems={[...faqItems]}
      />
    </>
  )
}
