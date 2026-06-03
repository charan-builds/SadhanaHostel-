import type { MetadataRoute } from "next"

import { hostelImages } from "@/constants/hostel-images"
import { absoluteUrl } from "@/lib/seo"

const publicSiteContentLastModified = new Date("2026-06-02T00:00:00.000Z")

const publicRoutes: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
  lastModified: Date
  images?: string[]
}> = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
    lastModified: publicSiteContentLastModified,
    images: [hostelImages.hero, hostelImages.exterior, hostelImages.gate],
  },
  {
    path: "/pulivendula-boys-hostel",
    changeFrequency: "weekly",
    priority: 0.98,
    lastModified: publicSiteContentLastModified,
    images: [hostelImages.exterior, hostelImages.gate, hostelImages.uploadedRooms],
  },
  {
    path: "/student-hostel-pulivendula",
    changeFrequency: "weekly",
    priority: 0.94,
    lastModified: publicSiteContentLastModified,
    images: [hostelImages.uploadedRooms, hostelImages.exterior],
  },
  {
    path: "/employee-hostel-pulivendula",
    changeFrequency: "weekly",
    priority: 0.94,
    lastModified: publicSiteContentLastModified,
    images: [hostelImages.exterior, hostelImages.gate],
  },
  {
    path: "/contact",
    changeFrequency: "monthly",
    priority: 0.9,
    lastModified: publicSiteContentLastModified,
    images: [hostelImages.gate],
  },
  {
    path: "/facilities",
    changeFrequency: "monthly",
    priority: 0.85,
    lastModified: publicSiteContentLastModified,
    images: [hostelImages.uploadedFacility, hostelImages.exterior],
  },
  {
    path: "/about",
    changeFrequency: "monthly",
    priority: 0.8,
    lastModified: publicSiteContentLastModified,
    images: [hostelImages.exterior],
  },
  {
    path: "/gallery",
    changeFrequency: "weekly",
    priority: 0.75,
    lastModified: publicSiteContentLastModified,
    images: [
      hostelImages.exterior,
      hostelImages.building,
      hostelImages.gate,
      hostelImages.uploadedFacility,
      hostelImages.uploadedRooms,
    ],
  },
  {
    path: "/support",
    changeFrequency: "monthly",
    priority: 0.45,
    lastModified: publicSiteContentLastModified,
  },
  {
    path: "/terms",
    changeFrequency: "yearly",
    priority: 0.35,
    lastModified: publicSiteContentLastModified,
  },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    images: route.images
      ? [...new Set(route.images.map((image) => absoluteUrl(image)))]
      : undefined,
  }))
}
