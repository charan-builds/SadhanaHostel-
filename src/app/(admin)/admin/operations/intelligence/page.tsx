import type { Metadata } from "next"

import { CompetitiveIntelligenceClient } from "@/components/admin/operations/competitive-intelligence-client"

export const metadata: Metadata = {
  title: "Competitive Intelligence",
}

export default function AdminOperationsIntelligencePage() {
  return <CompetitiveIntelligenceClient />
}
