import Link from "next/link"
import { MapPin, ShieldCheck, Sparkles, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { hostelConfig } from "@/constants/hostel"

const points = [
  { title: "Safe stay", icon: ShieldCheck },
  { title: "Clean environment", icon: Sparkles },
  { title: "Students and employees", icon: Users },
  { title: hostelConfig.location.note, icon: MapPin },
] as const

export function AboutPreview() {
  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-700">About the hostel</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
            A clean, practical stay in {hostelConfig.location.city}.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {hostelConfig.name} is designed for residents who need safe accommodation, a clean
            environment, daily essentials, and simple access to nearby education and work routes.
          </p>
          <Button asChild className="mt-6">
            <Link href="/about">Learn More</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {points.map((point) => {
            const Icon = point.icon

            return (
              <div key={point.title} className="rounded-xl border bg-white p-5 shadow-sm">
                <Icon className="size-5 text-blue-700" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-slate-950">{point.title}</h3>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
