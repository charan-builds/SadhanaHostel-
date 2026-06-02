import type { Metadata } from "next"

import { AboutPreview } from "@/components/public/about-preview"
import { FacilitiesPreview } from "@/components/public/facilities-preview"
import { FinalCta } from "@/components/public/final-cta"
import { GalleryPreview } from "@/components/public/gallery-preview"
import { HomeHero } from "@/components/public/home-hero"
import { HomeHighlights } from "@/components/public/home-highlights"
import { InquirySection } from "@/components/public/inquiry-section"
import { LocationCta } from "@/components/public/location-cta"
import { LocalSearchLinks } from "@/components/public/local-search-links"
import { RoomsPreview } from "@/components/public/rooms-preview"
import { SeoFaqSection } from "@/components/public/seo-faq-section"
import { TestimonialsSection } from "@/components/public/testimonials-section"
import { JsonLd } from "@/components/seo/json-ld"
import { getPublicCmsContent } from "@/lib/cms/public-cms"
import {
  createHomeFaqJsonLd,
  createLocalLandingPagesItemListJsonLd,
  createPublicMetadata,
  createPublicPageJsonLd,
} from "@/lib/seo"

const homeDescription =
  "Sadhana Boys Hostel in Pulivendula offers boys hostel rooms for students and employees with food, WiFi, CCTV, water, parking, and monthly fees from ₹3,500."

export const metadata: Metadata = createPublicMetadata({
  title: "Sadhana Boys Hostel Pulivendula | Student Rooms & Employee Hostel",
  description: homeDescription,
  path: "/",
  keywords: [
    "Pulivendula boys hostel",
    "Sadhana Boys Hostel Pulivendula",
    "student rooms Pulivendula",
    "employee accommodation Pulivendula",
  ],
})

export default async function HomePage() {
  const cms = await getPublicCmsContent()

  return (
    <main className="flex flex-1 flex-col">
      <JsonLd
        data={createPublicPageJsonLd({
          name: "Sadhana Boys Hostel Pulivendula",
          description: homeDescription,
          path: "/",
          image: "/images/hostel-exterior-wide.webp",
        })}
      />
      <JsonLd data={createHomeFaqJsonLd()} />
      <JsonLd data={createLocalLandingPagesItemListJsonLd()} />
      <HomeHero
        heroTitle={cms.heroTitle}
        heroSubtitle={cms.heroSubtitle}
        roomTypes={cms.roomTypes}
        galleryItems={cms.galleryItems}
        mapLink={cms.mapLink}
      />
      <HomeHighlights facilities={cms.facilities} />
      <AboutPreview />
      <RoomsPreview roomTypes={cms.roomTypes} galleryItems={cms.galleryItems} />
      <LocalSearchLinks />
      <FacilitiesPreview facilities={cms.facilities} galleryItems={cms.galleryItems} />
      <GalleryPreview galleryItems={cms.galleryItems} />
      <TestimonialsSection />
      <InquirySection />
      <LocationCta mapLink={cms.mapLink} />
      <SeoFaqSection />
      <FinalCta />
    </main>
  )
}
