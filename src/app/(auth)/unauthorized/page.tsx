import Link from "next/link"
import type { Metadata, Route } from "next"
import { ShieldAlert } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Unauthorized",
  description: "Your account does not have access to the requested area.",
}

export default function UnauthorizedPage() {
  return (
    <AuthShell
      title="Access restricted"
      description="Your account is active, but it is not allowed to open the requested workspace."
    >
      <div className="rounded-lg border bg-muted/30 p-5">
        <ShieldAlert className="size-8 text-destructive" aria-hidden="true" />
        <h2 className="mt-4 text-base font-semibold">You do not have permission here.</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ask the hostel administrator to review your role, organization, and hostel access.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href={"/admin/login" as Route}>Admin login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={"/resident/login" as Route}>Resident login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go to website</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
