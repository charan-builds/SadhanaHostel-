"use client"

import Link from "next/link"
import type { Route } from "next"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useOperationalAlerts } from "@/hooks"

export function AdminOperationalBanner() {
  const { organizationId, session } = useAuth()
  const alerts = useOperationalAlerts({
    organizationId: organizationId ?? undefined,
    hostelId: session?.hostelIds[0],
  })
  const importantAlert = alerts.data?.find((alert) =>
    alert.severity === "critical" || alert.severity === "high"
  )

  if (!importantAlert) {
    return null
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{importantAlert.title}</p>
            <p className="mt-1 text-sm leading-6 opacity-85">{importantAlert.description}</p>
          </div>
        </div>
        <Button asChild variant="outline" className="bg-background">
          <Link href={importantAlert.href as Route}>{importantAlert.ctaLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
