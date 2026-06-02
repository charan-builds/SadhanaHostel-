import Image from "next/image"
import Link from "next/link"
import type { Route } from "next"
import {
  BriefcaseBusiness,
  Camera,
  GraduationCap,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  Utensils,
  Wifi,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { LocalBusinessSummary } from "@/components/public/local-business-summary"
import { callHref, hostelConfig, mapSearchHref, whatsappHref } from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"
import { fallbackFaqItems } from "@/constants/public-content"

const stayOptions = [
  {
    title: "Student hostel rooms",
    description: "Study-friendly boys hostel stay for college students in Pulivendula.",
    price: hostelConfig.fees.student,
    icon: GraduationCap,
    href: "/student-hostel-pulivendula",
  },
  {
    title: "Employee accommodation",
    description: "Practical stay for employees and working professionals in Pulivendula.",
    price: hostelConfig.fees.employee,
    icon: BriefcaseBusiness,
    href: "/employee-hostel-pulivendula",
  },
] as const

const localFacilities = [
  {
    title: "Food",
    description: "Daily food support for a steady hostel routine.",
    icon: Utensils,
  },
  {
    title: "WiFi",
    description: "Internet access for study and work needs.",
    icon: Wifi,
  },
  {
    title: "CCTV",
    description: "Premises monitoring for better hostel supervision.",
    icon: Camera,
  },
  {
    title: "Water and parking",
    description: "Water availability and parking support for residents.",
    icon: ShieldCheck,
  },
] as const

export function PulivendulaHostelPageContent() {
  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_78%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="text-sm font-medium text-blue-700">Pulivendula boys hostel</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
              Boys hostel in Pulivendula for students and employees.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              {hostelConfig.name} is located on {hostelConfig.location.note}. The hostel supports
              student rooms, employee accommodation, food, WiFi, CCTV, water facilities, parking,
              and clear monthly fees.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg">
                <a href={callHref} aria-label={`Call ${hostelConfig.name}`}>
                  <Phone className="size-4" aria-hidden="true" />
                  Call Now
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Message ${hostelConfig.name} on WhatsApp`}
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white">
                <a href={mapSearchHref} target="_blank" rel="noreferrer">
                  <Navigation className="size-4" aria-hidden="true" />
                  Navigate
                </a>
              </Button>
            </div>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border bg-slate-100 shadow-lifted">
            <Image
              src={hostelImages.exterior}
              alt="Sadhana Boys Hostel building in Pulivendula"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 48vw, 100vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-950/64 via-slate-950/10 to-transparent" />
            <div className="absolute bottom-0 p-5 text-white">
              <p className="text-sm font-medium text-cyan-100">Actual hostel location</p>
              <p className="mt-1 text-2xl font-semibold">{hostelConfig.location.city}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">Fees and stay options</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
              Clear monthly hostel pricing in Pulivendula.
            </h2>
          </div>
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            {stayOptions.map((option) => {
              const Icon = option.icon

              return (
                <article key={option.title} className="rounded-2xl border bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <p className="rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white">
                      ₹{option.price}/month
                    </p>
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold text-slate-950">{option.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">{option.description}</p>
                  <div className="mt-5">
                    <Button asChild variant="outline">
                      <Link href={option.href as Route}>View details</Link>
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-blue-700">Why this hostel</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
              Useful facilities for a steady student and work routine.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The hostel is built for residents who need a simple, clean, and practical place to
              stay in Pulivendula with dependable daily essentials.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {localFacilities.map((facility) => {
              const Icon = facility.icon

              return (
                <article key={facility.title} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-950">{facility.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{facility.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <LocalBusinessSummary />

      <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">Pulivendula hostel FAQ</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
              Common questions before joining.
            </h2>
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {fallbackFaqItems.map((item) => (
              <article key={item.question} className="rounded-2xl border bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-950">{item.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
