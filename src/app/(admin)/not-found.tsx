import Link from "next/link"

import { EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"

export default function AdminNotFound() {
  return (
    <EmptyState
      title="Admin page not found"
      message="The requested admin workspace page does not exist."
      action={
        <Button asChild>
          <Link href="/admin/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  )
}
