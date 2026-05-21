import Link from "next/link"

import { EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"

export default function PublicNotFound() {
  return (
    <main className="mx-auto flex min-h-[60svh] w-full max-w-3xl items-center px-4 py-12">
      <EmptyState
        title="Page not found"
        message="The public page you are looking for does not exist."
        action={
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        }
      />
    </main>
  )
}
