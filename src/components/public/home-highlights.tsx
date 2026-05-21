import type { LucideIcon } from "lucide-react"
import {
  Bath,
  Camera,
  Cctv,
  Droplets,
  MapPin,
  ParkingCircle,
  ShieldCheck,
  Sparkles,
  Utensils,
  Wifi,
} from "lucide-react"

import { hostelConfig } from "@/constants/hostel"
import { fallbackFacilities } from "@/constants/public-content"
import type { FacilityItem } from "@/types/frontend"

const iconMap: Record<string, LucideIcon> = {
  bath: Bath,
  Bath,
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
  utensils: Utensils,
  Utensils,
  wifi: Wifi,
  Wifi,
}

function facilityByTitle(facilities: FacilityItem[], title: string) {
  return facilities.find((facility) => facility.title === title)
}

function getHighlightItems(facilities: FacilityItem[]) {
  return [
    facilityByTitle(facilities, "Tasty food") ?? facilityByTitle(facilities, "Food"),
    facilityByTitle(facilities, "WiFi"),
    facilityByTitle(facilities, "CCTV cameras") ?? facilityByTitle(facilities, "CCTV"),
    facilityByTitle(facilities, "24-hour water") ?? facilityByTitle(facilities, "Water"),
    facilityByTitle(facilities, "Parking")
    ? { ...facilityByTitle(facilities, "Parking")!, title: "Parking for employees" }
    : undefined,
    facilityByTitle(facilities, "Hot water for employees") ?? facilityByTitle(facilities, "Hot Water"),
    facilityByTitle(facilities, "Clean environment") ?? facilityByTitle(facilities, "Security"),
    {
      title: hostelConfig.location.note,
      description: "Convenient access for students around Pulivendula.",
      icon: "map-pin",
    },
  ].filter((item): item is FacilityItem => Boolean(item))
}

export function HomeHighlights({
  facilities = fallbackFacilities,
}: {
  facilities?: FacilityItem[]
}) {
  const highlightItems = getHighlightItems(facilities)

  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-blue-700">Hostel highlights</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
            Daily essentials for a comfortable stay.
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            A focused setup for students and employees who want a neat place, practical facilities,
            and easy access in {hostelConfig.location.city}.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlightItems.map((item) => {
            const Icon = iconMap[item.icon] ?? Sparkles

            return (
              <article
                key={item.title}
                className="rounded-xl border bg-white p-5 shadow-sm transition-colors hover:border-blue-200"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
