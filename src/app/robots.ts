import type { MetadataRoute } from "next"

import { absoluteUrl, isIndexableProductionUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  if (!isIndexableProductionUrl()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      sitemap: absoluteUrl("/sitemap.xml"),
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/about",
        "/rooms",
        "/admissions",
        "/facilities",
        "/gallery",
        "/tirupati-boys-hostel",
        "/hostel-near-colleges-tirupati",
        "/student-accommodation-tirupati",
        "/pulivendula-boys-hostel",
        "/student-hostel-pulivendula",
        "/employee-hostel-pulivendula",
        "/contact",
        "/privacy",
        "/support",
        "/terms",
      ],
      disallow: [
        "/admin/",
        "/resident/",
        "/api/",
        "/activate",
        "/forgot-password",
        "/login",
        "/onboarding",
        "/reset-password",
        "/unauthorized",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  }
}
