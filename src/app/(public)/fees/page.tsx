import Link from "next/link"
import type { Route } from "next"
import type { Metadata } from "next"
import { CheckCircle2, IndianRupee, MessageCircle, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LocalBusinessSummary } from "@/components/public/local-business-summary"
import { JsonLd } from "@/components/seo/json-ld"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import {
  createFaqJsonLd,
  createPublicMetadata,
  createPublicPageJsonLd,
  createRoomsOfferCatalogJsonLd,
} from "@/lib/seo"

const feesDescription = `${hostelConfig.name} monthly hostel fees: student rooms ₹${hostelConfig.fees.student}/month and employee accommodation ₹${hostelConfig.fees.employee}/month. Call or WhatsApp for current availability and joining details.`

const feePlans = [
  {
    title: "Student hostel fee",
    price: hostelConfig.fees.student,
    description: "Affordable monthly boys hostel stay for college students.",
    features: ["Monthly billing", "Food and basic facilities", "Study-friendly routine"],
  },
  {
    title: "Employee hostel fee",
    price: hostelConfig.fees.employee,
    description: "Practical accommodation for employees and working professionals.",
    features: ["Monthly billing", "Parking support", "Work-friendly routine"],
  },
] as const

const feesFaqItems = [
  {
    question: "What is the monthly hostel fee for students?",
    answer: `The student hostel fee is ₹${hostelConfig.fees.student}/month.`,
  },
  {
    question: "What is the monthly hostel fee for employees?",
    answer: `Employee accommodation is ₹${hostelConfig.fees.employee}/month.`,
  },
  {
    question: "How can I confirm the latest hostel fee before admission?",
    answer: "Call or WhatsApp the hostel before visiting to confirm current room availability, fees, and joining steps.",
  },
] as const

export const metadata: Metadata = createPublicMetadata({
  title: `Hostel Fees in Tirupati Region | ${hostelConfig.name}`,
  description: feesDescription,
  path: "/fees",
  keywords: [
    "hostel fees Tirupati",
    "boys hostel fees Tirupati",
    "student hostel fee Tirupati",
    "hostel monthly fee Tirupati",
  ],
})

export default function FeesPage() {
  return (
    <main className="flex flex-1 flex-col bg-white">
      <JsonLd
        data={createPublicPageJsonLd({
          name: `${hostelConfig.name} hostel fees`,
          description: feesDescription,
          path: "/fees",
          image: "/images/hostel-exterior-wide.webp",
        })}
      />
      <JsonLd data={createRoomsOfferCatalogJsonLd()} />
      <JsonLd data={createFaqJsonLd(feesFaqItems)} />

      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-blue-700">Hostel fees</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Clear monthly boys hostel fees for students and employees.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Compare monthly fees before visiting. Families searching from Tirupati can call ahead
            to confirm availability, rooms, and admission steps.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href={callHref}>
                <Phone className="size-4" aria-hidden="true" />
                Call for fee details
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-white">
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {feePlans.map((plan) => (
            <article key={plan.title} className="rounded-2xl border bg-white p-6 shadow-sm">
              <IndianRupee className="size-7 text-blue-700" aria-hidden="true" />
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">{plan.title}</h2>
              <p className="mt-3 text-4xl font-semibold text-slate-950">
                ₹{plan.price.toLocaleString("en-IN")}
                <span className="text-base font-medium text-slate-500">/month</span>
              </p>
              <p className="mt-3 text-base leading-7 text-slate-600">{plan.description}</p>
              <ul className="mt-5 grid gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="size-4 text-blue-700" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-7xl rounded-2xl border bg-slate-950 p-6 text-white">
          <h2 className="text-2xl font-semibold">Need admission details?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Fees can change with room availability and hostel policy. Confirm before travel.
          </p>
          <Button asChild className="mt-5 bg-white text-slate-950 hover:bg-blue-50">
            <Link href={"/admissions" as Route}>View admissions</Link>
          </Button>
        </div>
      </section>

      <LocalBusinessSummary />
    </main>
  )
}
