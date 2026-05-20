import type { Metadata } from "next"

import { FacilitiesPageContent } from "@/components/public/facilities-page-content"
import { hostelConfig } from "@/constants/hostel"

export const metadata: Metadata = {
  title: `Facilities | ${hostelConfig.name}`,
  description: `Facilities at ${hostelConfig.name} in Pulivendula include food, WiFi, CCTV, water, parking, and clean hostel spaces.`,
}

export default function FacilitiesPage() {
  return <FacilitiesPageContent />
}
