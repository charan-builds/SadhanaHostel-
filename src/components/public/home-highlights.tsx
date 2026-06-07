import { hostelConfig } from "@/constants/hostel"
import { fallbackFacilities } from "@/constants/public-content"
import type { FacilityItem } from "@/types/frontend"

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
            Daily essentials for a boys hostel in Pulivendula.
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            A focused setup for students and employees who want a neat place, practical facilities,
            and easy access in {hostelConfig.location.city}.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlightItems.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border bg-card/90 p-5 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted"
            >
              <span className="block size-10 rounded-lg bg-primary/10" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
