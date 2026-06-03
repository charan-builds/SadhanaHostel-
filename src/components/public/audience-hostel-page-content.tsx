import Image from "next/image"
import Link from "next/link"
import {
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  GraduationCap,
  MessageCircle,
  Phone,
  ShieldCheck,
  Utensils,
  Wifi,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { LocalBusinessSummary } from "@/components/public/local-business-summary"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"

type AudienceKind = "student" | "employee"

type AudienceHostelPageContentProps = {
  kind: AudienceKind
  eyebrow: string
  title: string
  description: string
  price: number
  priceContext: string
  highlights: Array<{
    title: string
    description: string
  }>
  faqItems: Array<{
    question: string
    answer: string
  }>
}

const facilityItems = [
  {
    title: "Food",
    description: "Daily food support for residents.",
    icon: Utensils,
  },
  {
    title: "WiFi",
    description: "Internet access for study and work.",
    icon: Wifi,
  },
  {
    title: "CCTV",
    description: "Hostel premises monitoring.",
    icon: Camera,
  },
  {
    title: "Water",
    description: "Water availability for daily needs.",
    icon: ShieldCheck,
  },
] as const

export function AudienceHostelPageContent({
  kind,
  eyebrow,
  title,
  description,
  price,
  priceContext,
  highlights,
  faqItems,
}: AudienceHostelPageContentProps) {
  const audienceIcon = kind === "student" ? GraduationCap : BriefcaseBusiness
  const AudienceIcon = audienceIcon
  const heroImage = kind === "student" ? hostelImages.uploadedRooms : hostelImages.exterior

  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_78%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="text-sm font-medium text-blue-700">{eyebrow}</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{description}</p>

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
                <Link href="/contact">Ask joining details</Link>
              </Button>
            </div>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border bg-slate-100 shadow-lifted">
            <Image
              src={heroImage}
              alt={`${hostelConfig.name} ${kind} hostel accommodation in Pulivendula`}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 48vw, 100vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-950/66 via-slate-950/10 to-transparent" />
            <div className="absolute bottom-0 p-5 text-white">
              <p className="text-sm font-medium text-cyan-100">{priceContext}</p>
              <p className="mt-1 text-3xl font-semibold">₹{price}/month</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border bg-white p-6 shadow-sm">
            <span className="flex size-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <AudienceIcon className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold text-slate-950">Monthly fee</h2>
            <p className="mt-3 text-4xl font-semibold text-slate-950">₹{price}</p>
            <p className="mt-2 text-base leading-7 text-slate-600">{priceContext}</p>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-2xl border bg-white p-5 shadow-sm">
                <CheckCircle2 className="size-5 text-blue-700" aria-hidden="true" />
                <h3 className="mt-4 font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">Facilities included</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
              Hostel essentials for daily life in Pulivendula.
            </h2>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {facilityItems.map((facility) => {
              const Icon = facility.icon

              return (
                <article key={facility.title} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-950">{facility.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {facility.description}
                  </p>
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
            <p className="text-sm font-medium text-blue-700">Questions</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
              Useful answers before joining.
            </h2>
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {faqItems.map((item) => (
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
