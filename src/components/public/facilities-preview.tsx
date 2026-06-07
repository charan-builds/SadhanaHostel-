import Image from "next/image"
import { hostelImages } from "@/constants/hostel-images"
import { fallbackFacilities } from "@/constants/public-content"
import { pickGalleryImage } from "@/lib/public-gallery"
import type { FacilityItem, GalleryItem } from "@/types/frontend"

export function FacilitiesPreview({
  facilities = fallbackFacilities,
  galleryItems,
}: {
  facilities?: FacilityItem[]
  galleryItems?: GalleryItem[]
}) {
  const selectedFacilities = facilities.slice(0, 6)
  const facilityImageUrl =
    pickGalleryImage(galleryItems, ["facility", "facilities", "dining", "amenity"], 0) ??
    hostelImages.uploadedFacility

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
          <a
            href="/facilities"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border/80 bg-white px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            View Facilities
          </a>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <div
            className="group relative min-h-80 overflow-hidden rounded-2xl border shadow-lifted"
          >
            <Image
              src={facilityImageUrl}
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
          {selectedFacilities.map((facility) => (
            <article
              key={facility.title}
              className="rounded-xl border bg-card/90 p-5 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted"
            >
              <div className="flex gap-4">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-foreground">{facility.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {facility.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
          </div>
        </div>
      </div>
    </section>
  )
}
