import type { Metadata } from "next"

import { AudienceHostelPageContent } from "@/components/public/audience-hostel-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import {
  createAccommodationOfferJsonLd,
  createFaqJsonLd,
  createPublicMetadata,
  createPublicPageJsonLd,
} from "@/lib/seo"

const pageDescription = `${hostelConfig.name} offers student hostel rooms in Pulivendula at ₹${hostelConfig.fees.student}/month with food, WiFi, CCTV, water facilities, parking support, and a study-friendly routine.`

const studentFaqItems = [
  {
    question: "What is the student hostel fee in Pulivendula?",
    answer: `The student hostel fee at ${hostelConfig.name} is ₹${hostelConfig.fees.student}/month.`,
  },
  {
    question: "Where is the student hostel located?",
    answer: `${hostelConfig.name} is located at ${hostelConfig.location.address}. The local landmark is ${hostelConfig.location.note}.`,
  },
  {
    question: "What facilities are available for students?",
    answer:
      "Students get food support, WiFi, CCTV monitoring, water facilities, parking support, and clean shared-room accommodation.",
  },
  {
    question: "Can students call before visiting?",
    answer:
      "Yes. Students or parents can call or WhatsApp before visiting to ask joining details.",
  },
]

export const metadata: Metadata = createPublicMetadata({
  title: `Student Hostel in Pulivendula | ${hostelConfig.name}`,
  description: pageDescription,
  path: "/student-hostel-pulivendula",
  keywords: [
    "student hostel Pulivendula",
    "student rooms Pulivendula",
    "college student hostel Pulivendula",
    "boys hostel for students Pulivendula",
    "3500 student hostel Pulivendula",
  ],
  image: "/images/image copy.png",
})

export default function StudentHostelPulivendulaPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Student hostel in Pulivendula",
          description: pageDescription,
          path: "/student-hostel-pulivendula",
          image: "/images/image copy.png",
        })}
      />
      <JsonLd
        data={createAccommodationOfferJsonLd({
          name: "Student hostel rooms in Pulivendula",
          description: pageDescription,
          path: "/student-hostel-pulivendula",
          price: hostelConfig.fees.student,
          accommodationName: "Student hostel room",
        })}
      />
      <JsonLd data={createFaqJsonLd(studentFaqItems)} />
      <AudienceHostelPageContent
        kind="student"
        eyebrow="Student hostel in Pulivendula"
        title="Student hostel rooms in Pulivendula."
        description={pageDescription}
        price={hostelConfig.fees.student}
        priceContext="Student monthly hostel fee"
        highlights={[
          {
            title: "Study-friendly routine",
            description: "A practical hostel setup for college students who need a steady routine.",
          },
          {
            title: "Clear monthly fee",
            description: `Student accommodation is listed clearly at ₹${hostelConfig.fees.student}/month.`,
          },
          {
            title: "Pulivendula location",
            description: `Located on ${hostelConfig.location.note} with practical local access.`,
          },
          {
            title: "Family-friendly clarity",
            description: "Parents can call before visiting to check rooms, fees, and joining details.",
          },
        ]}
        faqItems={studentFaqItems}
      />
    </>
  )
}
