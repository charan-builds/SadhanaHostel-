import Image from "next/image"
import Link from "next/link"
import type { Route } from "next"
import {
  CheckCircle2,
  GraduationCap,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { LocalBusinessSummary } from "@/components/public/local-business-summary"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"

type TirupatiSeoLandingPageContentProps = {
  eyebrow: string
  title: string
  description: string
  intentCards: Array<{
    title: string
    description: string
  }>
  faqItems: Array<{
    question: string
    answer: string
  }>
}

export function TirupatiSeoLandingPageContent({
  eyebrow,
  title,
  description,
  intentCards,
  faqItems,
}: TirupatiSeoLandingPageContentProps) {
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
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white">
                <Link href={"/admissions" as Route}>Admissions</Link>
              </Button>
            </div>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border bg-slate-100 shadow-lifted">
            <Image
              src={hostelImages.exterior}
              alt={`${hostelConfig.name} hostel building for Tirupati search visitors`}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 48vw, 100vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-950/66 via-slate-950/10 to-transparent" />
            <div className="absolute bottom-0 p-5 text-white">
              <p className="text-sm font-medium text-cyan-100">Hostel search from Tirupati</p>
              <p className="mt-1 text-2xl font-semibold">Call before visiting</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {intentCards.map((card) => (
            <article key={card.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <CheckCircle2 className="size-5 text-blue-700" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border bg-white p-6 shadow-sm">
            <GraduationCap className="size-7 text-blue-700" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">
              Student accommodation search
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Students and parents searching from Tirupati can compare rooms, monthly fees,
              facilities, and admission process before visiting.
            </p>
          </article>
          <article className="rounded-2xl border bg-white p-6 shadow-sm">
            <MapPin className="size-7 text-blue-700" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">
              Address and contact clarity
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              {hostelConfig.name} publishes its address, phone, WhatsApp, monthly fees, and map
              link clearly so visitors can verify details before travelling.
            </p>
          </article>
        </div>
      </section>

      <LocalBusinessSummary />

      <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">Tirupati hostel FAQ</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
              Questions before calling or visiting.
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
