import type { Metadata } from "next"

import { AdminAutomationClient } from "@/components/admin/operations/admin-automation-client"

export const metadata: Metadata = {
  title: "Operations Automation",
}

export default function AdminOperationsAutomationPage() {
  return <AdminAutomationClient />
}
