"use client"

import { motion } from "framer-motion"
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
    <section className="bg-background py-14 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-primary">Hostel highlights</p>
          <h2 className="text-gradient mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Daily essentials for a comfortable stay.
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            A focused setup for students and employees who want a neat place, practical facilities,
            and easy access in {hostelConfig.location.city}.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {highlightItems.map((item) => {
            const Icon = iconMap[item.icon] ?? Sparkles

            return (
              <motion.article
                key={item.title}
                variants={{
                  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
                  show: { opacity: 1, y: 0, filter: "blur(0px)" },
                }}
                className="rounded-xl border bg-card/90 p-5 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </motion.article>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
