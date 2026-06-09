import type { Metadata } from "next"

import { OperationsCenterClient } from "@/components/admin/operations/operations-center-client"

export const metadata: Metadata = {
  title: "Operations Center",
}

export default function AdminOperationsPage() {
  return <OperationsCenterClient />
}
