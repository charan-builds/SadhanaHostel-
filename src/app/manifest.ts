import type { MetadataRoute } from "next"

import { hostelConfig } from "@/constants/hostel"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${hostelConfig.name} Pulivendula`,
    short_name: hostelConfig.shortName,
    description:
      "Student and employee boys hostel in Pulivendula with food, WiFi, CCTV, water facilities, parking support, and clear monthly fees.",
    id: "/",
    start_url: "/resident/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#f8fbff",
    theme_color: "#0068b7",
    orientation: "portrait-primary",
    categories: ["business", "education", "lifestyle"],
    lang: "en-IN",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
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
    shortcuts: [
      {
        name: "Pay Fees",
        short_name: "Pay",
        description: "Open the fast resident fee payment flow",
        url: "/resident/pay-fees",
        icons: [{ src: "/pwa-icon/96", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Notices",
        short_name: "Notices",
        description: "Open hostel notices",
        url: "/resident/notices",
        icons: [{ src: "/pwa-icon/96", sizes: "96x96", type: "image/png" }],
      },
    ],
  }
}
