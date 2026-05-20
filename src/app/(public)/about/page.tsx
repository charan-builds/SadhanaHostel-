import type { Metadata } from "next"

import { AboutPageContent } from "@/components/public/about-page-content"
import { hostelConfig } from "@/constants/hostel"

export const metadata: Metadata = {
  title: `About ${hostelConfig.name}`,
  description: `${hostelConfig.name} offers safe, clean accommodation for students and employees in Pulivendula near Loyola Polytechnic College.`,
}

export default function AboutPage() {
  return <AboutPageContent />
}
