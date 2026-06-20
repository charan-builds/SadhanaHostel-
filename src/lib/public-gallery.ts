import { hostelGalleryImages } from "@/constants/hostel-images"
import { HOSTEL_LOCATION, mapEmbedHref, mapSearchHref } from "@/constants/hostel"
import { fallbackGalleryItems } from "@/constants/public-content"
import type { GalleryItem, RoomTypeCard } from "@/types/frontend"

const galleryCategoryLabels: Record<string, string> = {
  logo: "Logo",
  "student-room": "Student rooms",
  "employee-room": "Employee rooms",
  "exterior-surroundings": "Exterior / Surroundings",
  "open-space-terrace": "Open space / Terrace",
}

const galleryCategoryAliases: Record<string, keyof typeof galleryCategoryLabels> = {
  logo: "logo",
  brand: "logo",
  room: "student-room",
  rooms: "student-room",
  accommodation: "student-room",
  student: "student-room",
  "student-room": "student-room",
  "student-rooms": "student-room",
  employee: "employee-room",
  "employee-room": "employee-room",
  "employee-rooms": "employee-room",
  working: "employee-room",
  professional: "employee-room",
  facility: "open-space-terrace",
  facilities: "open-space-terrace",
  food: "open-space-terrace",
  dining: "open-space-terrace",
  terrace: "open-space-terrace",
  "common-area": "open-space-terrace",
  "open-space": "open-space-terrace",
  "open-space-terrace": "open-space-terrace",
  gallery: "exterior-surroundings",
  hero: "exterior-surroundings",
  hostel: "exterior-surroundings",
  building: "exterior-surroundings",
  exterior: "exterior-surroundings",
  surroundings: "exterior-surroundings",
  "exterior-surroundings": "exterior-surroundings",
}

const broadGalleryPreferences = new Set([
  "building",
  "facilities",
  "facility",
  "gallery",
  "hostel",
  "room",
  "rooms",
])

export function hydrateGalleryItems(galleryItems?: GalleryItem[]) {
  const sourceItems = galleryItems && galleryItems.length > 0 ? galleryItems : fallbackGalleryItems

  return sourceItems.map((item, index) => ({
    ...item,
    imageUrl: item.imageUrl ?? hostelGalleryImages[index % hostelGalleryImages.length],
  }))
}

export function hydratePublicGalleryItems(galleryItems?: GalleryItem[]) {
  const publicItems = hydrateGalleryItems(galleryItems).filter(isPublicGalleryPhoto)

  return publicItems.length > 0
    ? publicItems
    : hydrateGalleryItems(fallbackGalleryItems).filter(isPublicGalleryPhoto)
}

export function pickGalleryImage(
  galleryItems: GalleryItem[] | undefined,
  preferredCategories: string[],
  fallbackIndex = 0
) {
  const hydratedItems = hydratePublicGalleryItems(galleryItems)
  const normalizedCategories = preferredCategories
    .map(normalizeGalleryMatchKey)
    .filter(Boolean)
  const matchedItem = findPreferredGalleryItem(hydratedItems, normalizedCategories)

  return matchedItem?.imageUrl ?? hydratedItems[fallbackIndex % hydratedItems.length]?.imageUrl
}

export function pickRoomGalleryImage(
  galleryItems: GalleryItem[] | undefined,
  room: Pick<RoomTypeCard, "title" | "icon">,
  fallbackIndex = 0
) {
  const roomAudience = getRoomAudience(room)
  const preferredCategories =
    roomAudience === "employee"
      ? ["employee-room", "employee room", "employee rooms", "employee", "working", "professional"]
      : ["student-room", "student room", "student rooms", "student", "college"]

  return pickGalleryImage(galleryItems, preferredCategories, fallbackIndex)
}

export function pickBrandLogo(galleryItems?: GalleryItem[]) {
  return findPreferredGalleryItem(hydrateGalleryItems(galleryItems), ["logo", "brand"])?.imageUrl
}

function isPublicGalleryPhoto(item: GalleryItem) {
  const category = normalizeGalleryMatchKey(item.category)
  const title = normalizeGalleryMatchKey(item.title)

  return category !== "logo" &&
    category !== "brand" &&
    !title.includes("logo") &&
    !title.includes("brand-mark")
}

export function formatGalleryCategory(category: string) {
  const canonicalCategory = canonicalizeGalleryCategory(category)

  return galleryCategoryLabels[canonicalCategory]
}

export function canonicalizeGalleryCategory(category: string) {
  return galleryCategoryAliases[normalizeGalleryMatchKey(category)] ?? "exterior-surroundings"
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

function findPreferredGalleryItem(
  galleryItems: GalleryItem[],
  normalizedPreferences: string[]
) {
  for (const preference of normalizedPreferences) {
    const item = galleryItems.find((candidate) =>
      matchesGalleryPreference(candidate, preference)
    )

    if (item) {
      return item
    }
  }

  return undefined
}

function matchesGalleryPreference(item: GalleryItem, preference: string) {
  const category = normalizeGalleryMatchKey(item.category)
  const title = normalizeGalleryMatchKey(item.title)

  if (
    category === preference ||
    title === preference ||
    title.startsWith(`${preference}-`)
  ) {
    return true
  }

  if (broadGalleryPreferences.has(preference)) {
    return false
  }

  return (
    category.startsWith(`${preference}-`) ||
    category.endsWith(`-${preference}`) ||
    title.includes(`-${preference}-`) ||
    title.endsWith(`-${preference}`)
  )
}

function normalizeGalleryMatchKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function buildMapEmbedUrl(mapLink?: string | null) {
  const link = mapLink?.trim()

  if (!link) {
    return mapEmbedHref
  }

  if (link.includes("/embed?")) {
    return link
  }

  try {
    const url = new URL(link)
    const cid = url.searchParams.get("cid")

    if (cid) {
      return `https://www.google.com/maps?cid=${encodeURIComponent(cid)}&output=embed`
    }

    const query = url.searchParams.get("q") ?? url.searchParams.get("query")

    if (query && !isGenericHostelMapQuery(query)) {
      return buildQueryEmbedUrl(query)
    }
  } catch {
    if (!isGenericHostelMapQuery(link)) {
      return buildQueryEmbedUrl(link)
    }
  }

  return mapEmbedHref
}

export function buildMapNavigationUrl(mapLink?: string | null) {
  const link = mapLink?.trim()

  if (!link) {
    return mapSearchHref
  }

  try {
    const url = new URL(link)
    const query = url.searchParams.get("q") ?? url.searchParams.get("query")

    if (query && isGenericHostelMapQuery(query)) {
      return mapSearchHref
    }
  } catch {
    if (isGenericHostelMapQuery(link)) {
      return mapSearchHref
    }
  }

  return link
}

function buildQueryEmbedUrl(query: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}

function isGenericHostelMapQuery(query: string) {
  const normalizedQuery = query
    .toLowerCase()
    .replace(/\+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const exactQuery = HOSTEL_LOCATION.mapQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return (
    normalizedQuery === "sadhana boys hostel" ||
    normalizedQuery === "sadhana hostel" ||
    normalizedQuery === "sadhana boys hostel pulivendula" ||
    normalizedQuery === exactQuery
  )
}
