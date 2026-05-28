import type { Metadata } from "next"

import { AdminAutomationClient } from "@/components/admin/operations/admin-automation-client"

export const metadata: Metadata = {
  title: "Reset Demo/Test Data",
}

export default function AdminOperationsResetDemoDataPage() {
  return <AdminAutomationClient />
}
