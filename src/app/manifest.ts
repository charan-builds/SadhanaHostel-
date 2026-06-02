import type { MetadataRoute } from "next"

import { hostelConfig } from "@/constants/hostel"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${hostelConfig.name} Pulivendula`,
    short_name: hostelConfig.shortName,
    description:
      "Student and employee boys hostel in Pulivendula with food, WiFi, CCTV, water facilities, parking support, and clear monthly fees.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fbff",
    theme_color: "#0068b7",
    categories: ["business", "education", "lifestyle"],
    lang: "en-IN",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
