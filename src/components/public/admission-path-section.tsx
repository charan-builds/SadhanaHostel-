import {
  ClipboardCheck,
  Home,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"

const admissionSteps: Array<{
  title: string
  description: string
  icon: LucideIcon
}> = [
  {
    title: "Check availability",
    description: "Share your joining date so the hostel office can confirm current rooms.",
    icon: ClipboardCheck,
  },
  {
    title: "Speak with the office",
    description: "Call or WhatsApp before travelling to confirm fee, room, and visit timing.",
    icon: MessageCircle,
  },
  {
    title: "Visit the hostel",
    description: `Reach ${hostelConfig.location.note} and inspect the room before admission.`,
    icon: MapPin,
  },
  {
    title: "Complete admission",
    description: "Finish resident details, payment, and room allocation with the hostel team.",
    icon: Home,
  },
]

const proofPoints = [
  "Clear monthly fee before joining",
  "Direct hostel office callback",
  "Room visit before admission",
] as const

export function AdmissionPathSection() {
  return (
    <section className="border-b bg-white px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
        <div>
          <p className="text-sm font-medium text-blue-700">Visitor to inquiry to admission</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance">
            Know the joining path before you contact the hostel.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Confirm availability, speak with the hostel office, visit the room, then complete
            admission with clear expectations.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild>
              <a href="#inquiry" aria-label="Check current hostel room availability">
                <ClipboardCheck className="size-4" aria-hidden="true" />
                Check availability
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={callHref} aria-label={`Call ${hostelConfig.name}`}>
                <Phone className="size-4" aria-hidden="true" />
                Call office
              </a>
            </Button>
            <Button asChild variant="outline">
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

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {proofPoints.map((point) => (
              <div key={point} className="rounded-xl border bg-blue-50/70 p-4">
                <ShieldCheck className="size-4 text-blue-700" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">{point}</p>
              </div>
            ))}
          </div>

          <ol className="grid gap-3 sm:grid-cols-2">
            {admissionSteps.map((step, index) => {
              const Icon = step.icon

              return (
                <li
                  key={step.title}
                  className="rounded-xl border bg-slate-50 p-4 transition-colors hover:border-blue-200 hover:bg-white"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-blue-700" aria-hidden="true" />
                        <h3 className="text-base font-semibold text-slate-950">{step.title}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
