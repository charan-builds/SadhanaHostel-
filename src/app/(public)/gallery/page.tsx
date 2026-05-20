import type { Metadata } from "next"

import { GalleryPageContent } from "@/components/public/gallery-page-content"
import { hostelConfig } from "@/constants/hostel"

export const metadata: Metadata = {
  title: `Gallery | ${hostelConfig.name}`,
  description: `View hostel gallery placeholders for ${hostelConfig.name} in Pulivendula, including exterior, rooms, dining, and terrace spaces.`,
}

export default function GalleryPage() {
  return <GalleryPageContent />
}
