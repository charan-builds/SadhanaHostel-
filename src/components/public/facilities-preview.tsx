import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Bath,
  Bed,
  Cctv,
  Droplets,
  ParkingCircle,
  Sparkles,
  Utensils,
  Wifi,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { facilities } from "@/data/public"

const iconMap: Record<string, LucideIcon> = {
  Bath,
  Bed,
  Cctv,
  Droplets,
  ParkingCircle,
  Sparkles,
  Utensils,
  Wifi,
}

const selectedFacilities = facilities.slice(0, 6)

export function FacilitiesPreview() {
  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">Facilities</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
              Everything residents need for a steady routine.
            </h2>
          </div>
          <Button asChild variant="outline" className="bg-white">
            <Link href="/facilities">View Facilities</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {selectedFacilities.map((facility) => {
            const Icon = iconMap[facility.icon] ?? Sparkles

            return (
              <article key={facility.title} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-950">{facility.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {facility.description}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
