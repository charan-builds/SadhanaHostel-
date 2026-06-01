import { hostelGalleryImages } from "@/constants/hostel-images"
import { HOSTEL_LOCATION, mapEmbedHref, mapSearchHref } from "@/constants/hostel"
import { fallbackGalleryItems } from "@/constants/public-content"
import type { GalleryItem, RoomTypeCard } from "@/types/frontend"

const galleryCategoryLabels: Record<string, string> = {
  "student-room": "Student rooms",
  "employee-room": "Employee rooms",
  room: "Rooms",
  facility: "Facilities",
  gallery: "Gallery",
  hero: "Hostel exterior",
  hostel: "Hostel",
  logo: "Logo",
}

export function hydrateGalleryItems(galleryItems?: GalleryItem[]) {
  const sourceItems = galleryItems && galleryItems.length > 0 ? galleryItems : fallbackGalleryItems

  return sourceItems.map((item, index) => ({
    ...item,
    imageUrl: item.imageUrl ?? hostelGalleryImages[index % hostelGalleryImages.length],
  }))
}

export function pickGalleryImage(
  galleryItems: GalleryItem[] | undefined,
  preferredCategories: string[],
  fallbackIndex = 0
) {
  const hydratedItems = hydrateGalleryItems(galleryItems)
  const normalizedCategories = preferredCategories.map((category) => category.toLowerCase())
  const matchedItem = hydratedItems.find((item) =>
    normalizedCategories.some((category) => item.category.toLowerCase().includes(category))
  )

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
      ? ["employee-room", "employee room", "employee", "working", "professional", "room"]
      : ["student-room", "student room", "student", "college", "room"]

  return pickGalleryImage(galleryItems, preferredCategories, fallbackIndex)
}

export function pickBrandLogo(galleryItems?: GalleryItem[]) {
  return hydrateGalleryItems(galleryItems).find((item) =>
    ["logo", "brand"].some((category) => item.category.toLowerCase().includes(category))
  )?.imageUrl
}

export function formatGalleryCategory(category: string) {
  const normalizedCategory = category.toLowerCase().trim()

  return (
    galleryCategoryLabels[normalizedCategory] ??
    normalizedCategory
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  )
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
