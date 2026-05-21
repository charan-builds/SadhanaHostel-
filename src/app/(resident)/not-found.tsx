import Link from "next/link"

import { EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"

export default function ResidentNotFound() {
  return (
    <EmptyState
      title="Resident page not found"
      message="The requested resident portal page does not exist."
      action={
        <Button asChild>
          <Link href="/resident/dashboard">Back to portal</Link>
        </Button>
      }
    />
  )
}
