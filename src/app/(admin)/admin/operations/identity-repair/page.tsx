import type { Metadata } from "next"

import { AdminAutomationClient } from "@/components/admin/operations/admin-automation-client"

export const metadata: Metadata = {
  title: "Identity Repair",
}

export default function AdminOperationsIdentityRepairPage() {
  return <AdminAutomationClient />
}
