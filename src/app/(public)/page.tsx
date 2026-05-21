import { AboutPreview } from "@/components/public/about-preview"
import { FacilitiesPreview } from "@/components/public/facilities-preview"
import { FinalCta } from "@/components/public/final-cta"
import { GalleryPreview } from "@/components/public/gallery-preview"
import { HomeHero } from "@/components/public/home-hero"
import { HomeHighlights } from "@/components/public/home-highlights"
import { LocationCta } from "@/components/public/location-cta"
import { RoomsPreview } from "@/components/public/rooms-preview"
import { getPublicCmsContent } from "@/lib/cms/public-cms"

export default async function HomePage() {
  const cms = await getPublicCmsContent()

  return (
    <main className="flex flex-1 flex-col">
      <HomeHero
        heroTitle={cms.heroTitle}
        heroSubtitle={cms.heroSubtitle}
        roomTypes={cms.roomTypes}
      />
      <HomeHighlights facilities={cms.facilities} />
      <AboutPreview />
      <RoomsPreview roomTypes={cms.roomTypes} />
      <FacilitiesPreview facilities={cms.facilities} />
      <GalleryPreview galleryItems={cms.galleryItems} />
      <LocationCta />
      <FinalCta />
    </main>
  )
}
