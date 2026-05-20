import type { Metadata } from "next"

import { RoomsPageContent } from "@/components/public/rooms-page-content"
import { hostelConfig } from "@/constants/hostel"

export const metadata: Metadata = {
  title: `Rooms and Pricing | ${hostelConfig.name}`,
  description: `Rooms for students and employees at ${hostelConfig.name} in Pulivendula with clear monthly pricing.`,
}

export default function RoomsPage() {
  return <RoomsPageContent />
}
