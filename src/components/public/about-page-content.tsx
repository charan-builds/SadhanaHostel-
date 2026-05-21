import { MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"

const trustCards = [
  {
    title: "Safe and comfortable stay",
    description: "A disciplined hostel environment for residents and families who value routine.",
    icon: ShieldCheck,
  },
  {
    title: "Clean environment",
    description: "Neat shared spaces and practical facilities for daily student and employee life.",
    icon: Sparkles,
  },
  {
    title: "Students and employees",
    description: "Suitable for college students and working professionals staying in Pulivendula.",
    icon: Users,
  },
] as const

export function AboutPageContent({ aboutText }: { aboutText?: string | null }) {
  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-blue-700">About {hostelConfig.shortName}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Safe, clean accommodation for students and working professionals.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            {aboutText ||
              `${hostelConfig.name} provides a practical hostel stay in ${hostelConfig.location.city}, close to ${hostelConfig.location.note.replace("Near ", "")}. The hostel is built around comfort, cleanliness, food, water, WiFi, and a resident-friendly daily routine.`}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
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
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-blue-700">Our focus</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
              A straightforward hostel experience families can trust.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The hostel is suited for college students who need a study-friendly routine and
              employees who need a comfortable, accessible stay. Families can trust the simple
              rules, monitored premises, clean environment, and clear monthly fee structure.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {trustCards.map((card) => {
              const Icon = card.icon

              return (
                <article key={card.title} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-950">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <MapPin className="size-6 text-blue-700" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Location advantage</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              {hostelConfig.location.address}. The hostel is {hostelConfig.location.note}, making
              it convenient for students and residents moving around {hostelConfig.location.city}.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-950 p-6 text-white shadow-sm">
            <h2 className="text-2xl font-semibold">Want to check availability?</h2>
            <p className="mt-3 text-base leading-7 text-slate-300">
              Call or send a WhatsApp message to ask about rooms, facilities, and monthly plans.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="bg-white text-slate-950 hover:bg-blue-50">
                <a href={callHref}>
                  <Phone className="size-4" aria-hidden="true" />
                  Call Now
                </a>
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
