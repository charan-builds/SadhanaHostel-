import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getMaintenanceMessage } from "@/config/launch"
import { hostelConfig } from "@/constants/hostel"

export default function MaintenancePage() {
  return (
    <main className="min-h-svh bg-slate-50 px-4 py-12">
      <section className="mx-auto grid min-h-[70svh] max-w-2xl content-center gap-6">
        <div className="rounded-xl border bg-background p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-700">{hostelConfig.name}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Operations are briefly paused
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {getMaintenanceMessage()}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/api/health/live">Check service health</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/support">Contact support</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
