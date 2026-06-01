"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { BriefcaseBusiness, CheckCircle2, GraduationCap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { hostelImages } from "@/constants/hostel-images"
import { fallbackRoomTypes } from "@/constants/public-content"
import { pickRoomGalleryImage } from "@/lib/public-gallery"
import type { GalleryItem, RoomTypeCard } from "@/types/frontend"

const iconMap: Record<string, LucideIcon> = {
  BriefcaseBusiness,
  "briefcase-business": BriefcaseBusiness,
  GraduationCap,
  "graduation-cap": GraduationCap,
}

export function RoomsPreview({
  roomTypes = fallbackRoomTypes,
  galleryItems,
}: {
  roomTypes?: RoomTypeCard[]
  galleryItems?: GalleryItem[]
}) {
  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Rooms and pricing</p>
            <h2 className="text-gradient mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Clear monthly plans for students and employees.
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/rooms">Explore Rooms</Link>
          </Button>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="mt-8 grid gap-5 lg:grid-cols-2"
        >
          {roomTypes.map((room, index) => {
            const Icon = iconMap[room.icon] ?? GraduationCap
            const roomImageUrl =
              pickRoomGalleryImage(galleryItems, room, index) ??
              (index === 0 ? hostelImages.gate : hostelImages.building)

            return (
              <motion.article
                key={room.title}
                variants={{
                  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
                  show: { opacity: 1, y: 0, filter: "blur(0px)" },
                }}
                className="group overflow-hidden rounded-2xl border bg-card/90 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted"
              >
                <div className="relative aspect-[16/8] overflow-hidden">
                  {roomImageUrl.startsWith("/") ? (
                    <Image
                      src={roomImageUrl}
                      alt={`${room.title} preview at Sadhana Boys Hostel`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(min-width: 1024px) 50vw, 100vw"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={roomImageUrl}
                      alt={`${room.title} preview at Sadhana Boys Hostel`}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/55 to-transparent" />
                  <p className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-950">
                    {room.priceLabel}
                  </p>
                </div>
                <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">{room.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{room.description}</p>
                  </div>
                </div>

                <ul className="mt-6 grid gap-3">
                  {room.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                </div>
              </motion.article>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
