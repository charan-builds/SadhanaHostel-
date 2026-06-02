import Image from "next/image"
import type { LucideIcon } from "lucide-react"
import { BriefcaseBusiness, CheckCircle2, GraduationCap, MessageCircle, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"
import { fallbackRoomTypes } from "@/constants/public-content"
import { pickGalleryImage, pickRoomGalleryImage } from "@/lib/public-gallery"
import type { GalleryItem, RoomTypeCard } from "@/types/frontend"

const iconMap: Record<string, LucideIcon> = {
  BriefcaseBusiness,
  "briefcase-business": BriefcaseBusiness,
  GraduationCap,
  "graduation-cap": GraduationCap,
}

const comparisonRows = [
  ["Monthly fee", `₹${hostelConfig.fees.student}/month`, `₹${hostelConfig.fees.employee}/month`],
  ["Best for", "College students in Pulivendula", "Employees / working professionals"],
  ["Stay focus", "Affordable, study-friendly routine", "Comfort, parking, and vehicle access"],
  ["Extra facilities", "Daily essentials", "Parking support and work-friendly routine"],
] as const

export function RoomsPageContent({
  roomTypes = fallbackRoomTypes,
  galleryItems,
}: {
  roomTypes?: RoomTypeCard[]
  galleryItems?: GalleryItem[]
}) {
  const heroImageUrl = pickGalleryImage(galleryItems, ["room", "accommodation", "hostel", "building"], 0) ?? hostelImages.gate

  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
          <p className="text-sm font-medium text-blue-700">Rooms and pricing</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Boys hostel rooms in Pulivendula for students and employees.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Choose a practical monthly stay at {hostelConfig.name} near{" "}
            {hostelConfig.location.note}. Student rooms are ₹{hostelConfig.fees.student}/month and
            employee accommodation is ₹{hostelConfig.fees.employee}/month.
          </p>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border bg-slate-100 shadow-lifted">
            {heroImageUrl.startsWith("/") ? (
              <Image
                src={heroImageUrl}
                alt="Sadhana Boys Hostel room plan preview"
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 48vw, 100vw"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImageUrl}
                alt="Sadhana Boys Hostel room plan preview"
                className="size-full object-cover"
                fetchPriority="high"
              />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-slate-950/55 to-transparent" />
            <div className="absolute bottom-0 p-5 text-white">
              <p className="text-sm font-medium text-cyan-100">Actual hostel entrance</p>
              <p className="mt-1 text-2xl font-semibold">Simple monthly stays</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
          {roomTypes.map((room, index) => {
            const Icon = iconMap[room.icon] ?? GraduationCap
            const roomImageUrl =
              pickRoomGalleryImage(galleryItems, room, index) ??
              (index % 2 === 0 ? hostelImages.building : hostelImages.exterior)

            return (
              <article key={room.title} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="relative aspect-[16/8]">
                  {roomImageUrl.startsWith("/") ? (
                    <Image
                      src={roomImageUrl}
                      alt={`${room.title} hostel view`}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 50vw, 100vw"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={roomImageUrl}
                      alt={`${room.title} hostel view`}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <p className="rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white">
                    {room.priceLabel}
                  </p>
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-slate-950">{room.title}</h2>
                <p className="mt-3 text-base leading-7 text-slate-600">{room.description}</p>
                <ul className="mt-6 grid gap-3">
                  {room.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="size-4 text-blue-700" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-semibold text-slate-950">Compare stay options</h2>
          <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
            {comparisonRows.map((row) => (
              <div
                key={row[0]}
                className="grid gap-3 border-b p-4 last:border-b-0 md:grid-cols-3 md:items-center"
              >
                <p className="font-medium text-slate-950">{row[0]}</p>
                <p className="text-sm leading-6 text-slate-600">{row[1]}</p>
                <p className="text-sm leading-6 text-slate-600">{row[2]}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <a href={callHref} aria-label={`Call ${hostelConfig.name}`}>
                <Phone className="size-4" aria-hidden="true" />
                Call Now
              </a>
            </Button>
            <Button asChild variant="outline" className="bg-white">
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
