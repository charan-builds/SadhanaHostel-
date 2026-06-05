import type { Metadata } from "next"
import { LockKeyhole, ShieldCheck } from "lucide-react"

import { JsonLd } from "@/components/seo/json-ld"
import { hostelConfig } from "@/constants/hostel"
import { createPublicMetadata, createPublicPageJsonLd } from "@/lib/seo"

const privacyDescription = `${hostelConfig.name} privacy policy for admission inquiries, resident contact details, payment communication, and website form submissions.`

const privacySections = [
  {
    title: "Information collected",
    description:
      "Admission inquiries may collect name, phone number, stay type, joining date, and message details needed to respond.",
  },
  {
    title: "How information is used",
    description:
      "Information is used for hostel admission follow-up, room availability communication, fee clarification, and resident support.",
  },
  {
    title: "Data protection",
    description:
      "Access to operational records is limited to authorized hostel staff and administrators.",
  },
  {
    title: "Contact",
    description:
      "For privacy questions, call or message the hostel using the contact details published on this website.",
  },
] as const

export const metadata: Metadata = createPublicMetadata({
  title: `Privacy Policy | ${hostelConfig.name}`,
  description: privacyDescription,
  path: "/privacy",
  keywords: ["Sadhana Boys Hostel privacy", "hostel admission privacy policy"],
})

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col bg-white">
      <JsonLd
        data={createPublicPageJsonLd({
          name: `${hostelConfig.name} privacy policy`,
          description: privacyDescription,
          path: "/privacy",
        })}
      />

      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-medium text-blue-700">Privacy</p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Privacy policy for hostel inquiries and resident communication.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{privacyDescription}</p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-4">
          {privacySections.map((section, index) => (
            <article key={section.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  {index === 0 ? (
                    <LockKeyhole className="size-5" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="size-5" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <h2 className="font-semibold text-slate-950">{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
