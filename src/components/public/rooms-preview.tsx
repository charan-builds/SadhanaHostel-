import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { BriefcaseBusiness, CheckCircle2, GraduationCap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fallbackRoomTypes } from "@/constants/public-content"
import type { RoomTypeCard } from "@/types/frontend"

const iconMap: Record<string, LucideIcon> = {
  BriefcaseBusiness,
  "briefcase-business": BriefcaseBusiness,
  GraduationCap,
  "graduation-cap": GraduationCap,
}

export function RoomsPreview({
  roomTypes = fallbackRoomTypes,
}: {
  roomTypes?: RoomTypeCard[]
}) {
  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">Rooms and pricing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
              Clear monthly plans for students and employees.
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/rooms">Explore Rooms</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {roomTypes.map((room) => {
            const Icon = iconMap[room.icon] ?? GraduationCap

            return (
              <article
                key={room.title}
                className="rounded-2xl border bg-white p-6 shadow-sm transition-colors hover:border-blue-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-xl font-semibold text-slate-950">{room.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{room.description}</p>
                  </div>
                  <p className="rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white">
                    {room.priceLabel}
                  </p>
                </div>

                <ul className="mt-6 grid gap-3">
                  {room.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="size-4 text-blue-700" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
