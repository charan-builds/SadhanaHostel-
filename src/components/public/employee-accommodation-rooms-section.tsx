import Image from "next/image"
import { BedDouble, CheckCircle2, Users } from "lucide-react"

import type { EmployeeAccommodationRoom } from "@/types/frontend"

export function EmployeeAccommodationRoomsSection({
  rooms,
}: {
  rooms: EmployeeAccommodationRoom[]
}) {
  if (rooms.length === 0) {
    return null
  }

  return (
    <section className="bg-white px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-blue-700">Employee accommodation rooms</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950 text-balance">
            Working professional rooms managed by the hostel team.
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            See room photos, capacity, and amenities published directly from the admin panel.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {rooms.map((room, index) => (
            <article
              key={room.id}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lifted"
            >
              <RoomImage room={room} priority={index === 0} />
              <div className="grid gap-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950">{room.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {room.description || "Employee accommodation room details."}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-sm font-medium text-blue-700">
                    <Users className="size-4" aria-hidden="true" />
                    {room.capacity}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Amenities
                  </p>
                  <ul className="mt-3 grid gap-2">
                    {room.amenities.length > 0 ? (
                      room.amenities.map((amenity) => (
                        <li key={amenity} className="flex items-center gap-2 text-sm text-slate-700">
                          <CheckCircle2 className="size-4 text-blue-700" aria-hidden="true" />
                          {amenity}
                        </li>
                      ))
                    ) : (
                      <li className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="size-4 text-blue-700" aria-hidden="true" />
                        Hostel essentials
                      </li>
                    )}
                  </ul>
                </div>

                {room.images.length > 1 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {room.images.slice(1, 5).map((image) => (
                      <div key={`${room.id}-${image.imageUrl ?? image.title}`} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                        <RoomImageSource
                          src={image.imageUrl}
                          alt={image.alt}
                          sizes="8rem"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function RoomImage({
  room,
  priority,
}: {
  room: EmployeeAccommodationRoom
  priority: boolean
}) {
  const image = room.images[0]

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
      {image ? (
        <RoomImageSource
          src={image.imageUrl}
          alt={image.alt}
          priority={priority}
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover transition-transform duration-500 hover:scale-105"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_58%,#e2e8f0_100%)]">
          <BedDouble className="size-12 text-blue-700" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

function RoomImageSource({
  src,
  alt,
  priority,
  sizes,
  className,
}: {
  src?: string
  alt: string
  priority?: boolean
  sizes: string
  className?: string
}) {
  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-slate-100">
        <BedDouble className="size-6 text-blue-700" aria-hidden="true" />
      </div>
    )
  }

  if (src.startsWith("/")) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        {...(priority ? { priority: true } : { loading: "lazy" as const })}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`size-full ${className ?? ""}`}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  )
}
