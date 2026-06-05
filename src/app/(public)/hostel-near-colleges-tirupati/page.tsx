import type { Metadata } from "next"

import { TirupatiSeoLandingPageContent } from "@/components/public/tirupati-seo-landing-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { createFaqJsonLd, createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const description = `Students searching for hostels near colleges in Tirupati can use this page to compare boys hostel fees, facilities, room options, and admission steps with ${hostelConfig.name}.`

const faqItems = [
  {
    question: "How should college students compare hostels near Tirupati?",
    answer: "Check monthly fees, food, WiFi, water, CCTV, rules, travel route, and whether the hostel confirms availability before you visit.",
  },
  {
    question: "Can I ask for admission details before visiting?",
    answer: "Yes. Call or WhatsApp the hostel to confirm current availability and joining process.",
  },
  {
    question: "What fee is listed for students?",
    answer: `The student hostel fee is listed from ₹${hostelConfig.fees.student}/month.`,
  },
] as const

export const metadata: Metadata = createPublicMetadata({
  title: `Hostel Near Colleges in Tirupati | Student Accommodation`,
  description,
  path: "/hostel-near-colleges-tirupati",
  keywords: [
    "hostel near colleges in Tirupati",
    "student hostel near college Tirupati",
    "boys hostel near degree college Tirupati",
    "hostel near engineering college Tirupati",
  ],
})

export default function HostelNearCollegesTirupatiPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Hostel near colleges in Tirupati",
          description,
          path: "/hostel-near-colleges-tirupati",
          image: "/images/hostel-courtyard-clean.webp",
        })}
      />
      <JsonLd data={createFaqJsonLd(faqItems)} />
      <TirupatiSeoLandingPageContent
        eyebrow="Hostel near college searches"
        title="Hostel near colleges in Tirupati: what students should compare."
        description={description}
        intentCards={[
          {
            title: "Student fee clarity",
            description: `Compare the listed student fee of ₹${hostelConfig.fees.student}/month before visiting.`,
          },
          {
            title: "Daily essentials",
            description: "Ask about food, WiFi, water, study routine, CCTV, and hostel rules.",
          },
          {
            title: "Admission planning",
            description: "Call ahead so parents and students know room availability and joining steps.",
          },
        ]}
        faqItems={[...faqItems]}
      />
    </>
  )
}
