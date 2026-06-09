import "server-only"

import { cache } from "react"
import { unstable_cache } from "next/cache"

import {
  fallbackFacilities,
  fallbackGalleryItems,
  fallbackRoomTypes,
  termsAndRules,
} from "@/constants/public-content"
import { HostelRulesService } from "@/services/hostel-rules.service"
import { WebsiteService } from "@/services/website.service"
import type { Tables } from "@/types/database"
import type {
  EmployeeAccommodationRoom,
  FacilityItem,
  GalleryItem,
  LeadFormContent,
  PublicHostelRule,
  RoomTypeCard,
} from "@/types/frontend"

type CmsObject = Record<string, unknown>
type WebsiteSettingCmsRow = Pick<Tables<"website_settings">, "content" | "section_key">
type GalleryCmsRow = Tables<"gallery"> & { imageUrl?: string | null }
type EmployeeAccommodationCmsRow = Awaited<
  ReturnType<WebsiteService["listEmployeeAccommodationRooms"]>
>["data"][number]

export type PublicCmsContent = {
  heroTitle: string | null
  heroSubtitle: string | null
  aboutText: string | null
  mapLink: string | null
  roomTypes: RoomTypeCard[]
  facilities: FacilityItem[]
  galleryItems: GalleryItem[]
  employeeAccommodationRooms: EmployeeAccommodationRoom[]
  hostelRules: PublicHostelRule[]
  leadForm: LeadFormContent
  source: "cms" | "fallback"
}

export const PUBLIC_CMS_CACHE_TAG = "public-cms-content-v2"
const publicCmsCacheRevalidateSeconds = 60
const publicCmsGalleryPageSize = 100

export const getPublicCmsContent = cache(async (): Promise<PublicCmsContent> => {
  const organizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
  const hostelId = process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID

  return getCachedPublicCmsContent(organizationId || "", hostelId || "")
})

const getCachedPublicCmsContent = unstable_cache(
  async (organizationId: string, hostelId: string): Promise<PublicCmsContent> =>
    loadPublicCmsContent(organizationId, hostelId),
  [PUBLIC_CMS_CACHE_TAG],
  {
    revalidate: publicCmsCacheRevalidateSeconds,
    tags: [PUBLIC_CMS_CACHE_TAG],
  }
)

async function loadPublicCmsContent(
  organizationId: string,
  hostelId: string
): Promise<PublicCmsContent> {
  try {
    const service = WebsiteService.createPublic()
    const rulesService = HostelRulesService.createPublic()
    const [settingsResult, facilitiesResult, galleryResult, employeeRoomsResult, rulesResult] =
      await Promise.allSettled([
        service.listSettings({
          organizationId: organizationId || undefined,
          hostelId: hostelId || undefined,
          page: 1,
          pageSize: 20,
          status: "published",
        }),
        service.listFacilities({
          organizationId: organizationId || undefined,
          hostelId: hostelId || undefined,
          page: 1,
          pageSize: 50,
          status: "published",
        }),
        service.listGallery({
          organizationId: organizationId || undefined,
          hostelId: hostelId || undefined,
          page: 1,
          pageSize: publicCmsGalleryPageSize,
          status: "published",
        }),
        service.listEmployeeAccommodationRooms({
          organizationId: organizationId || undefined,
          hostelId: hostelId || undefined,
          page: 1,
          pageSize: 50,
          status: "published",
        }),
        rulesService.listRules({
          organizationId: organizationId || undefined,
          hostelId: hostelId || undefined,
          page: 1,
          pageSize: 100,
          activeOnly: true,
        }),
      ])
    const settingsRows =
      settingsResult.status === "fulfilled" ? settingsResult.value.data : []
    const facilityRows =
      facilitiesResult.status === "fulfilled" ? facilitiesResult.value.data : []
    const galleryRows =
      galleryResult.status === "fulfilled" ? galleryResult.value.data : []
    const employeeRoomRows =
      employeeRoomsResult.status === "fulfilled" ? employeeRoomsResult.value.data : []
    const ruleRows =
      rulesResult.status === "fulfilled" ? rulesResult.value.rules : []

    if (
      settingsRows.length === 0 &&
      facilityRows.length === 0 &&
      galleryRows.length === 0 &&
      employeeRoomRows.length === 0 &&
      ruleRows.length === 0
    ) {
      return fallbackCmsContent()
    }

    return buildCmsContent(
      settingsRows,
      facilityRows,
      galleryRows,
      employeeRoomRows,
      ruleRows
    )
  } catch {
    return fallbackCmsContent()
  }
}

function buildCmsContent(
  settingsRows: WebsiteSettingCmsRow[],
  facilityRows: Tables<"facilities">[],
  galleryRows: GalleryCmsRow[],
  employeeRoomRows: EmployeeAccommodationCmsRow[],
  ruleRows: Tables<"hostel_rules">[]
): PublicCmsContent {
  const settings = Object.fromEntries(
    settingsRows.map((setting) => [setting.section_key, setting])
  )
  const homepage = asObject(settings.homepage?.content)
  const about = asObject(settings.about?.content)
  const contact = asObject(settings.contact?.content)
  const pricing = asObject(settings.pricing?.content)
  const terms = asObject(settings.terms?.content)
  const hostelRules = mapHostelRules(ruleRows, getHostelRules(terms))
  const leadForm = mapLeadFormContent(contact)
  const roomTypes = withRequiredRoomAudiences(mapPricingToRoomTypes(pricing))
  const facilities = facilityRows.map(mapFacility)
  const galleryItems = galleryRows.map(mapGalleryItem)
  const employeeAccommodationRooms = employeeRoomRows.map(mapEmployeeAccommodationRoom)

  return {
    heroTitle: stringOrNull(homepage.hero_title),
    heroSubtitle: stringOrNull(homepage.hero_subtitle),
    aboutText: stringOrNull(about.about_text),
    mapLink: stringOrNull(contact.map_link),
    roomTypes: roomTypes.length > 0 ? roomTypes : fallbackRoomTypes,
    facilities: facilities.length > 0 ? facilities : fallbackFacilities,
    galleryItems: galleryItems.length > 0 ? galleryItems : fallbackGalleryItems,
    employeeAccommodationRooms,
    hostelRules,
    leadForm,
    source: "cms",
  }
}

function fallbackCmsContent(): PublicCmsContent {
  return {
    heroTitle: null,
    heroSubtitle: null,
    aboutText: null,
    mapLink: null,
    roomTypes: fallbackRoomTypes,
    facilities: fallbackFacilities,
    galleryItems: fallbackGalleryItems,
    employeeAccommodationRooms: [],
    hostelRules: fallbackHostelRules(),
    leadForm: fallbackLeadFormContent(),
    source: "fallback",
  }
}

function mapLeadFormContent(contact: CmsObject): LeadFormContent {
  const fallback = fallbackLeadFormContent()

  return {
    title:
      stringOrNull(contact.lead_form_title) ??
      stringOrNull(contact.leadFormTitle) ??
      fallback.title,
    subtitle:
      stringOrNull(contact.lead_form_subtitle) ??
      stringOrNull(contact.leadFormSubtitle) ??
      fallback.subtitle,
    description:
      stringOrNull(contact.lead_form_description) ??
      stringOrNull(contact.leadFormDescription) ??
      fallback.description,
    ctaText:
      stringOrNull(contact.lead_form_cta_text) ??
      stringOrNull(contact.leadFormCtaText) ??
      fallback.ctaText,
    imageUrl:
      stringOrNull(contact.lead_form_image_url) ??
      stringOrNull(contact.leadFormImageUrl) ??
      undefined,
  }
}

function fallbackLeadFormContent(): LeadFormContent {
  return {
    title: "Send an inquiry",
    subtitle: "Submit your details so the hostel team can call back and explain the joining process.",
    description: "Only three fields. The hostel office will call you back quickly.",
    ctaText: "Request callback",
  }
}

function mapFacility(facility: Tables<"facilities">): FacilityItem {
  return {
    title: facility.name,
    description: facility.description ?? "",
    icon: facility.icon_name ?? "sparkles",
  }
}

function mapGalleryItem(item: Tables<"gallery"> & { imageUrl?: string | null }): GalleryItem {
  return {
    title: item.title,
    category: item.category ?? "general",
    alt: item.alt_text ?? item.title,
    imageUrl: item.imageUrl ?? undefined,
  }
}

function mapEmployeeAccommodationRoom(
  room: EmployeeAccommodationCmsRow
): EmployeeAccommodationRoom {
  return {
    id: room.id,
    title: room.title,
    description: room.description ?? "",
    capacity: room.capacity,
    amenities: room.amenities,
    images: room.images.map(mapGalleryItem),
  }
}

function mapHostelRules(
  rules: Tables<"hostel_rules">[],
  legacyRules: string[]
): PublicHostelRule[] {
  if (rules.length > 0) {
    return rules.map((rule) => ({
      id: rule.id,
      category: rule.category,
      title: rule.title,
      description: rule.description,
      displayOrder: rule.display_order,
      updatedAt: rule.updated_at,
    }))
  }

  if (legacyRules.length > 0) {
    return legacyRules.map((rule, index) => ({
      id: `legacy-${index + 1}`,
      category: "General",
      title: rule,
      description: rule,
      displayOrder: (index + 1) * 10,
      updatedAt: "",
    }))
  }

  return fallbackHostelRules()
}

function fallbackHostelRules(): PublicHostelRule[] {
  return termsAndRules.map((rule, index) => ({
    id: `fallback-${index + 1}`,
    category: "General",
    title: rule,
    description: rule,
    displayOrder: (index + 1) * 10,
    updatedAt: "",
  }))
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

function withRequiredRoomAudiences(roomTypes: RoomTypeCard[]) {
  const hasStudent = roomTypes.some((room) => getRoomAudience(room) === "student")
  const hasEmployee = roomTypes.some((room) => getRoomAudience(room) === "employee")
  const requiredRoomTypes = [...roomTypes]

  if (!hasStudent) {
    requiredRoomTypes.push(fallbackRoomTypes[0])
  }

  if (!hasEmployee) {
    requiredRoomTypes.push(fallbackRoomTypes[1])
  }

  return requiredRoomTypes.filter(Boolean)
}

function getRoomAudience(room: Pick<RoomTypeCard, "title" | "icon">) {
  const value = `${room.title} ${room.icon}`.toLowerCase()

  return value.includes("employee") ||
    value.includes("working") ||
    value.includes("professional") ||
    value.includes("briefcase")
    ? "employee"
    : "student"
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

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
}

function getHostelRules(terms: Record<string, unknown>) {
  const listRules = stringArray(terms.rules)

  if (listRules.length > 0) {
    return listRules
  }

  const legacyRules = stringArray(terms.terms_and_rules)

  if (legacyRules.length > 0) {
    return legacyRules
  }

  return ["payment_rules", "leave_policy", "conduct_rules"]
    .map((key) => terms[key])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}
