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
        "/facilities",
        "/gallery",
        "/pulivendula-boys-hostel",
        "/student-hostel-pulivendula",
        "/employee-hostel-pulivendula",
        "/contact",
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
