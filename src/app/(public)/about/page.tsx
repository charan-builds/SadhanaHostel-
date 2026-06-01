import type { Metadata } from "next"

import { AboutPageContent } from "@/components/public/about-page-content"
import { hostelConfig } from "@/constants/hostel"
import { getPublicCmsContent } from "@/lib/cms/public-cms"

export const metadata: Metadata = {
  title: `About ${hostelConfig.name}`,
  description: `${hostelConfig.name} offers safe, clean accommodation for students and employees in Pulivendula on ${hostelConfig.location.note}.`,
}

export default async function AboutPage() {
  const cms = await getPublicCmsContent()

  return <AboutPageContent aboutText={cms.aboutText} />
}
