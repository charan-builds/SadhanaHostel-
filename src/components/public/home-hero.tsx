"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { CheckCircle2, MapPin, MessageCircle, Navigation, Phone, ShieldCheck, Star, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, mapSearchHref, whatsappHref } from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"
import { fallbackRoomTypes } from "@/constants/public-content"
import { buildMapNavigationUrl, pickGalleryImage } from "@/lib/public-gallery"
import type { GalleryItem, RoomTypeCard } from "@/types/frontend"

const trustBadges = [
  hostelConfig.location.note,
  "CCTV monitored premises",
  "Students and employees welcome",
] as const

export function HomeHero({
  heroTitle = hostelConfig.name,
  heroSubtitle = `Safe, neat, and affordable accommodation for students and working professionals in ${hostelConfig.location.city}.`,
  roomTypes = fallbackRoomTypes,
  galleryItems,
  mapLink,
}: {
  heroTitle?: string | null
  heroSubtitle?: string | null
  roomTypes?: RoomTypeCard[]
  galleryItems?: GalleryItem[]
  mapLink?: string | null
}) {
  const heroImageUrl = pickGalleryImage(galleryItems, ["hero", "exterior", "hostel", "building"], 0) ?? hostelImages.hero
  const locationHref = buildMapNavigationUrl(mapLink) || mapSearchHref

  return (
    <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden border-b bg-slate-950 text-white">
      {heroImageUrl.startsWith("/") ? (
        <Image
          src={heroImageUrl}
          alt="Sadhana Boys Hostel building"
          fill
          priority
          className="object-cover transition-transform duration-[1200ms] ease-out"
          sizes="100vw"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImageUrl}
          alt="Sadhana Boys Hostel building"
          className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-out"
          fetchPriority="high"
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.86)_0%,rgba(15,23,42,0.7)_42%,rgba(15,23,42,0.2)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-background to-transparent" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 pb-14 pt-16 sm:px-6 md:pb-16 md:pt-24 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-xl">
            <MapPin className="size-3.5 text-blue-600" aria-hidden="true" />
            {hostelConfig.location.city}, {hostelConfig.location.state}
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {heroTitle || hostelConfig.name}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
            {heroSubtitle}
          </p>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
            Located on {hostelConfig.location.note}, {hostelConfig.name} provides comfortable rooms,
            tasty food, WiFi, CCTV, water facility, and a clean environment.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="h-11 px-4">
              <a href={callHref} aria-label={`Call ${hostelConfig.name}`}>
                <Phone className="size-4" aria-hidden="true" />
                Call Now
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 border-white/20 bg-white/10 px-4 text-white hover:bg-white/15">
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
            <Button asChild variant="outline" size="lg" className="h-11 border-white/20 bg-white/10 px-4 text-white hover:bg-white/15">
              <a
                href={locationHref}
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${hostelConfig.name} on map`}
              >
                <Navigation className="size-4" aria-hidden="true" />
                View on Map
              </a>
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {trustBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/82 shadow-sm backdrop-blur-xl"
              >
                <CheckCircle2 className="size-3.5 text-cyan-200" aria-hidden="true" />
                {badge}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.75, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block"
        >
          <div className="ml-auto max-w-md rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="grid gap-3">
              <HeroMetric icon={ShieldCheck} label="Monitored" value="CCTV" />
              <HeroMetric icon={Star} label="Student fee" value={roomTypes[0]?.priceLabel ?? "Clear pricing"} />
              <HeroMetric icon={CheckCircle2} label="Location" value={hostelConfig.location.note} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function HeroMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
      <Icon className="size-5 text-cyan-200" aria-hidden="true" />
      <p className="mt-4 text-xs text-white/58">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
