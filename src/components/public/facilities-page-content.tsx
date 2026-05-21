import type { LucideIcon } from "lucide-react"
import {
  Bath,
  Bed,
  Camera,
  Cctv,
  Droplets,
  Info,
  MapPin,
  MessageCircle,
  ParkingCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  ThermometerSun,
  Utensils,
  WashingMachine,
  Wifi,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { fallbackFacilities } from "@/constants/public-content"
import type { FacilityItem } from "@/types/frontend"

const iconMap: Record<string, LucideIcon> = {
  bath: Bath,
  Bath,
  bed: Bed,
  Bed,
  camera: Camera,
  Cctv,
  cctv: Cctv,
  droplets: Droplets,
  Droplets,
  "map-pin": MapPin,
  MapPin,
  "parking-circle": ParkingCircle,
  ParkingCircle,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  Sparkles,
  "thermometer-sun": ThermometerSun,
  utensils: Utensils,
  Utensils,
  "washing-machine": WashingMachine,
  wifi: Wifi,
  Wifi,
}

const extraFacilities = [
  {
    title: hostelConfig.location.note,
    description: "Convenient hostel location for nearby college access.",
    icon: "MapPin",
  },
]

export function FacilitiesPageContent({
  facilities = fallbackFacilities,
}: {
  facilities?: FacilityItem[]
}) {
  const allFacilities = [...facilities, ...extraFacilities]

  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-blue-700">Facilities</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Practical facilities for a clean and comfortable stay.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            {hostelConfig.name} supports daily routines with food, WiFi, CCTV, water facilities,
            parking options, and a neat environment.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allFacilities.map((facility) => {
            const Icon = iconMap[facility.icon] ?? Sparkles

            return (
              <article key={facility.title} className="rounded-2xl border bg-white p-5 shadow-sm">
                <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-slate-950">{facility.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{facility.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <Info className="size-6 text-blue-700" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Food note</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              No fixed menu. All types of food and tiffins can be prepared depending on
              availability and hostel management.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-950 p-6 text-white shadow-sm">
            <h2 className="text-2xl font-semibold">Need facility details?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Call or message to ask about rooms, food, parking, hot water, and employee facilities.
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
