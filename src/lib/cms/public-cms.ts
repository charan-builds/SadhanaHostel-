import "server-only"

import { cache } from "react"

import {
  fallbackFacilities,
  fallbackGalleryItems,
  fallbackRoomTypes,
} from "@/constants/public-content"
import { WebsiteService } from "@/services/website.service"
import type { Tables } from "@/types/database"
import type { FacilityItem, GalleryItem, RoomTypeCard } from "@/types/frontend"

type CmsObject = Record<string, unknown>

export type PublicCmsContent = {
  heroTitle: string | null
  heroSubtitle: string | null
  aboutText: string | null
  mapLink: string | null
  roomTypes: RoomTypeCard[]
  facilities: FacilityItem[]
  galleryItems: GalleryItem[]
  source: "cms" | "fallback"
}

export const getPublicCmsContent = cache(async (): Promise<PublicCmsContent> => {
  const organizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
  const hostelId = process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID

  if (!organizationId) {
    return fallbackCmsContent()
  }

  try {
    const service = await WebsiteService.create()
    const [settingsResult, facilitiesResult, galleryResult] = await Promise.all([
      service.listSettings({
        organizationId,
        hostelId: hostelId || undefined,
        page: 1,
        pageSize: 20,
        status: "published",
      }),
      service.listFacilities({
        organizationId,
        hostelId: hostelId || undefined,
        page: 1,
        pageSize: 50,
        status: "published",
      }),
      service.listGallery({
        organizationId,
        hostelId: hostelId || undefined,
        page: 1,
        pageSize: 50,
        status: "published",
      }),
    ])

    const settings = Object.fromEntries(
      settingsResult.data.map((setting) => [setting.section_key, setting])
    )
    const homepage = asObject(settings.homepage?.content)
    const about = asObject(settings.about?.content)
    const contact = asObject(settings.contact?.content)
    const pricing = asObject(settings.pricing?.content)
    const roomTypes = mapPricingToRoomTypes(pricing)
    const facilities = facilitiesResult.data.map(mapFacility)
    const galleryItems = galleryResult.data.map(mapGalleryItem)

    return {
      heroTitle: stringOrNull(homepage.hero_title),
      heroSubtitle: stringOrNull(homepage.hero_subtitle),
      aboutText: stringOrNull(about.about_text),
      mapLink: stringOrNull(contact.map_link),
      roomTypes: roomTypes.length > 0 ? roomTypes : fallbackRoomTypes,
      facilities: facilities.length > 0 ? facilities : fallbackFacilities,
      galleryItems: galleryItems.length > 0 ? galleryItems : fallbackGalleryItems,
      source: "cms",
    }
  } catch {
    return fallbackCmsContent()
  }
})

function fallbackCmsContent(): PublicCmsContent {
  return {
    heroTitle: null,
    heroSubtitle: null,
    aboutText: null,
    mapLink: null,
    roomTypes: fallbackRoomTypes,
    facilities: fallbackFacilities,
    galleryItems: fallbackGalleryItems,
    source: "fallback",
  }
}

function mapFacility(facility: Tables<"facilities">): FacilityItem {
  return {
    title: facility.name,
    description: facility.description ?? "",
    icon: facility.icon_name ?? "sparkles",
  }
}

function mapGalleryItem(item: Tables<"gallery">): GalleryItem {
  return {
    title: item.title,
    category: item.category ?? "general",
    alt: item.alt_text ?? item.title,
  }
}

function mapPricingToRoomTypes(pricing: CmsObject): RoomTypeCard[] {
  const feeStructure = Array.isArray(pricing.fee_structure)
    ? pricing.fee_structure
    : []

  return feeStructure
    .map((entry) => asObject(entry))
    .filter((entry) => typeof entry.label === "string")
    .map((entry, index) => {
      const monthlyFee = Number(entry.monthly_fee ?? 0)
      const title = String(entry.label)

      return {
        title,
        price: monthlyFee,
        priceLabel: monthlyFee > 0 ? `₹${monthlyFee}/month` : "Contact for pricing",
        description:
          stringOrNull(entry.description) ??
          "Published CMS pricing for the selected hostel room category.",
        features: mapFeatures(entry.features),
        icon: index === 0 ? "graduation-cap" : "briefcase-business",
      }
    })
}

function mapFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["Monthly billing", "Hostel facilities", "Admin-managed pricing"]
  }

  return value.filter((item): item is string => typeof item === "string").slice(0, 5)
}

function asObject(value: unknown): CmsObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as CmsObject
  }

  return {}
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}
