import { AboutPreview } from "@/components/public/about-preview"
import { FacilitiesPreview } from "@/components/public/facilities-preview"
import { FinalCta } from "@/components/public/final-cta"
import { GalleryPreview } from "@/components/public/gallery-preview"
import { HomeHero } from "@/components/public/home-hero"
import { HomeHighlights } from "@/components/public/home-highlights"
import { LocationCta } from "@/components/public/location-cta"
import { RoomsPreview } from "@/components/public/rooms-preview"

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <HomeHero />
      <HomeHighlights />
      <AboutPreview />
      <RoomsPreview />
      <FacilitiesPreview />
      <GalleryPreview />
      <LocationCta />
      <FinalCta />
    </main>
  )
}
