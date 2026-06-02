import {
  IndianRupee,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  callHref,
  hostelConfig,
  mapSearchHref,
  whatsappHref,
} from "@/constants/hostel"

const localBusinessFacts = [
  {
    label: "Business name",
    value: hostelConfig.name,
    icon: MapPin,
  },
  {
    label: "Address",
    value: hostelConfig.location.address,
    icon: Navigation,
  },
  {
    label: "Local area",
    value: hostelConfig.location.note,
    icon: MapPin,
  },
  {
    label: "Phone",
    value: `+91 ${hostelConfig.contact.phone}`,
    icon: Phone,
  },
  {
    label: "WhatsApp",
    value: `+91 ${hostelConfig.contact.whatsapp}`,
    icon: MessageCircle,
  },
  {
    label: "Student monthly fee",
    value: formatMonthlyFee(hostelConfig.fees.student),
    icon: IndianRupee,
  },
  {
    label: "Employee monthly fee",
    value: formatMonthlyFee(hostelConfig.fees.employee),
    icon: IndianRupee,
  },
] as const

export function LocalBusinessSummary() {
  return (
    <section className="border-y bg-white px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-7 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {hostelConfig.location.city} hostel details
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
              {hostelConfig.name} address, contact, and monthly fees.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Visit or contact the hostel on {hostelConfig.location.note} before joining to confirm
              current room availability.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild>
                <a href={callHref}>
                  <Phone className="size-4" aria-hidden="true" />
                  Call
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={mapSearchHref} target="_blank" rel="noreferrer">
                  <Navigation className="size-4" aria-hidden="true" />
                  Navigate
                </a>
              </Button>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            {localBusinessFacts.map((fact) => {
              const Icon = fact.icon

              return (
                <div key={fact.label} className="rounded-xl border bg-slate-50 p-4">
                  <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Icon className="size-4 text-blue-700" aria-hidden="true" />
                    {fact.label}
                  </dt>
                  <dd className="mt-2 text-base font-semibold leading-7 text-slate-950">
                    {fact.value}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      </div>
    </section>
  )
}

function formatMonthlyFee(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}/month`
}
