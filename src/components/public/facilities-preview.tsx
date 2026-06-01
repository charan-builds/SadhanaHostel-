"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import {
  Bath,
  Bed,
  Camera,
  Cctv,
  Droplets,
  ParkingCircle,
  ShieldCheck,
  Sparkles,
  ThermometerSun,
  Utensils,
  WashingMachine,
  Wifi,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { hostelImages } from "@/constants/hostel-images"
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

export function FacilitiesPreview({
  facilities = fallbackFacilities,
}: {
  facilities?: FacilityItem[]
}) {
  const selectedFacilities = facilities.slice(0, 6)

  return (
    <section className="bg-muted/45 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Facilities</p>
            <h2 className="text-gradient mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Everything residents need for a steady routine.
            </h2>
          </div>
          <Button asChild variant="outline" className="bg-white">
            <Link href="/facilities">View Facilities</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="group relative min-h-80 overflow-hidden rounded-2xl border shadow-lifted"
          >
            <Image
              src={hostelImages.building}
              alt="Sadhana Boys Hostel facility exterior"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(min-width: 1024px) 42vw, 100vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-950/78 via-slate-950/12 to-transparent" />
            <div className="absolute bottom-0 p-6 text-white">
              <p className="text-sm font-medium text-cyan-100">Actual hostel view</p>
              <h3 className="mt-2 text-3xl font-semibold tracking-tight">Daily essentials in one place.</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/72">
                Food, water, WiFi, CCTV, parking, and maintained common spaces for a steady routine.
              </p>
            </div>
          </motion.div>

          <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {selectedFacilities.map((facility) => {
            const Icon = iconMap[facility.icon] ?? Sparkles

            return (
              <motion.article
                key={facility.title}
                variants={{
                  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
                  show: { opacity: 1, y: 0, filter: "blur(0px)" },
                }}
                className="rounded-xl border bg-card/90 p-5 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted"
              >
                <div className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{facility.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {facility.description}
                    </p>
                  </div>
                </div>
              </motion.article>
            )
          })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
