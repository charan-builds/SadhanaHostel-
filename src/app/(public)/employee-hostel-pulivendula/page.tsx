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

const pageDescription = `${hostelConfig.name} offers employee hostel accommodation in Pulivendula at ₹${hostelConfig.fees.employee}/month for working professionals with food, WiFi, CCTV, water facilities, and parking support.`

const employeeFaqItems = [
  {
    question: "What is the employee hostel fee in Pulivendula?",
    answer: `Employee and working professional accommodation at ${hostelConfig.name} is ₹${hostelConfig.fees.employee}/month.`,
  },
  {
    question: "Is parking support available for employees?",
    answer:
      "Parking support is available for residents, subject to hostel rules and available space.",
  },
  {
    question: "Where is the employee hostel located?",
    answer: `${hostelConfig.name} is located at ${hostelConfig.location.address}. The hostel is on ${hostelConfig.location.note}.`,
  },
  {
    question: "Can working professionals check vacancy by phone?",
    answer:
      "Yes. Working professionals can call or WhatsApp before visiting to confirm current vacancy and joining details.",
  },
]

export const metadata: Metadata = createPublicMetadata({
  title: `Employee Hostel in Pulivendula | ${hostelConfig.name}`,
  description: pageDescription,
  path: "/employee-hostel-pulivendula",
  keywords: [
    "employee hostel Pulivendula",
    "working professionals hostel Pulivendula",
    "employee accommodation Pulivendula",
    "boys hostel for employees Pulivendula",
    "5000 employee hostel Pulivendula",
  ],
  image: "/images/hostel-exterior-wide.webp",
})

export default function EmployeeHostelPulivendulaPage() {
  return (
    <>
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Employee hostel in Pulivendula",
          description: pageDescription,
          path: "/employee-hostel-pulivendula",
          image: "/images/hostel-exterior-wide.webp",
        })}
      />
      <JsonLd
        data={createAccommodationOfferJsonLd({
          name: "Employee hostel accommodation in Pulivendula",
          description: pageDescription,
          path: "/employee-hostel-pulivendula",
          price: hostelConfig.fees.employee,
          accommodationName: "Employee hostel accommodation",
        })}
      />
      <JsonLd data={createFaqJsonLd(employeeFaqItems)} />
      <AudienceHostelPageContent
        kind="employee"
        eyebrow="Employee hostel in Pulivendula"
        title="Employee hostel accommodation in Pulivendula."
        description={pageDescription}
        price={hostelConfig.fees.employee}
        priceContext="Employee monthly hostel fee"
        highlights={[
          {
            title: "Work-friendly stay",
            description:
              "A practical hostel setup for employees and working professionals in Pulivendula.",
          },
          {
            title: "Clear monthly fee",
            description: `Employee accommodation is listed clearly at ₹${hostelConfig.fees.employee}/month.`,
          },
          {
            title: "Parking support",
            description: "Parking support is available for residents, subject to hostel rules.",
          },
          {
            title: "Easy to check vacancy",
            description: "Call or WhatsApp before visiting to confirm rooms and joining details.",
          },
        ]}
        faqItems={employeeFaqItems}
      />
    </>
  )
}
