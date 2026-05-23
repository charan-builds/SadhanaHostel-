import type { Metadata } from "next"

import { ResidentSupportClient } from "@/components/resident/resident-support-client"

export const metadata: Metadata = {
  title: "Support & Recovery",
}

export default function ResidentSupportPage() {
  return <ResidentSupportClient />
}
