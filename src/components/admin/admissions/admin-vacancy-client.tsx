"use client"

import Link from "next/link"
import type { Route } from "next"
import {
  Activity,
  ArrowRight,
  Building2,
  ShieldAlert,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HOSTEL_TOTAL_CAPACITY } from "@/constants/hostel"
import { useDashboardAnalytics } from "@/hooks"
import { useAuth } from "@/lib/auth"

export function AdminVacancyClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const analytics = useDashboardAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
  })
  const lifecycle = analytics.data?.residentLifecycle
  const activeResidents = lifecycle?.activeResidents ?? 0
  const registeredResidents = analytics.data?.totalResidents ?? lifecycle?.registeredResidents ?? 0
  const pendingVerification = lifecycle?.pendingVerification ?? 0
  const availableCapacity = Math.max(HOSTEL_TOTAL_CAPACITY - activeResidents, 0)

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  if (analytics.isError) {
    return (
      <APIErrorState
        title="Occupancy snapshot could not be loaded"
        error={analytics.error}
        onRetry={() => void analytics.refetch()}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-blue-700">Admissions</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Occupancy Snapshot
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Vacancy tracking has been removed from this launch. Capacity insight now comes
          from resident lifecycle data and the configured launch capacity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <OccupancyMetric
          title="Launch Capacity"
          value={HOSTEL_TOTAL_CAPACITY}
          icon={Building2}
        />
        <OccupancyMetric
          title="Active Residents"
          value={activeResidents}
          icon={Users}
          loading={analytics.isLoading}
        />
        <OccupancyMetric
          title="Available Capacity"
          value={availableCapacity}
          icon={Activity}
          loading={analytics.isLoading}
        />
        <OccupancyMetric
          title="Registered Residents"
          value={registeredResidents}
          icon={UserRoundCheck}
          loading={analytics.isLoading}
        />
        <OccupancyMetric
          title="Pending Verification"
          value={pendingVerification}
          icon={ShieldAlert}
          loading={analytics.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Room-wise vacancy retired</CardTitle>
          <CardDescription>
            Room-wise vacancy tables are disabled for this launch so admins do not rely
            on the removed vacancy endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="text-sm leading-6 text-muted-foreground">
            Use resident lifecycle, admissions follow-ups, and room management for daily
            operating decisions. Operations Center and Intelligence use the same safe
            occupancy signals.
          </p>
          <Button asChild variant="outline">
            <Link href={"/admin/residents" as Route}>
              Open residents
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function OccupancyMetric({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Icon className="size-5 text-blue-700" aria-hidden="true" />
          {loading ? "..." : value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
