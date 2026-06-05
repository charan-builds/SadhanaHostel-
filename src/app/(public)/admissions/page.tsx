import type { Metadata } from "next"
import { ClipboardCheck, FileText, MessageCircle, Phone, UserCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LocalBusinessSummary } from "@/components/public/local-business-summary"
import { JsonLd } from "@/components/seo/json-ld"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { createFaqJsonLd, createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const admissionsDescription = `Admission details for ${hostelConfig.name}: call or WhatsApp to confirm room availability, monthly fees, student or employee stay type, and joining steps before visiting.`

const admissionSteps = [
  {
    title: "Call or WhatsApp",
    description: "Confirm current availability, monthly fee, and suitable room type.",
    icon: Phone,
  },
  {
    title: "Share basic details",
    description: "Resident name, phone number, student or employee category, and expected joining date.",
    icon: UserCheck,
  },
  {
    title: "Visit hostel",
    description: `Visit ${hostelConfig.location.note} to inspect rooms and complete admission.`,
    icon: ClipboardCheck,
  },
  {
    title: "Complete records",
    description: "Submit required resident details and follow hostel rules before staying.",
    icon: FileText,
  },
] as const

const admissionsFaqItems = [
  {
    question: "How do I join Sadhana Boys Hostel?",
    answer: "Call or WhatsApp first, confirm availability, then visit the hostel to complete admission details.",
  },
  {
    question: "Can Tirupati students ask for hostel admission details?",
    answer: "Yes. Students and families searching from Tirupati can call before travelling to confirm room availability and fees.",
  },
  {
    question: "What information is needed before admission?",
    answer: "Resident name, phone number, stay type, joining date, and basic guardian/contact details are usually required.",
  },
] as const

export const metadata: Metadata = createPublicMetadata({
  title: `Hostel Admissions | ${hostelConfig.name}`,
  description: admissionsDescription,
  path: "/admissions",
  keywords: [
    "hostel admission Tirupati",
    "boys hostel admission Tirupati",
    "student hostel admission Tirupati",
    "Sadhana Boys Hostel admission",
  ],
})

export default function AdmissionsPage() {
  return (
    <main className="flex flex-1 flex-col bg-white">
      <JsonLd
        data={createPublicPageJsonLd({
          name: `${hostelConfig.name} admissions`,
          description: admissionsDescription,
          path: "/admissions",
          image: "/images/hostel-gate.webp",
        })}
      />
      <JsonLd data={createFaqJsonLd(admissionsFaqItems)} />

      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-blue-700">Admissions</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Hostel admission steps for students and employees.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Call before visiting to confirm room availability, monthly fees, joining date, and
            hostel rules. This helps families travelling from Tirupati plan the visit clearly.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href={callHref}>
                <Phone className="size-4" aria-hidden="true" />
                Call admissions
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
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {admissionSteps.map((step, index) => {
            const Icon = step.icon

            return (
              <article key={step.title} className="rounded-2xl border bg-white p-5 shadow-sm">
                <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-medium text-blue-700">Step {index + 1}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <LocalBusinessSummary />
    </main>
  )
}
