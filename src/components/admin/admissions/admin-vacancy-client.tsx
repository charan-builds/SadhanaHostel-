"use client"

import { Activity, BedDouble, Building2, Clock, ShieldAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAdmissionsAnalytics, useAdmissionsVacancy } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { useRealtimeAdmissions } from "@/lib/realtime"

export function AdminVacancyClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const vacancy = useAdmissionsVacancy({
    organizationId: organizationId ?? "",
    hostelId,
  })
  const analytics = useAdmissionsAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
  })
  const summary = vacancy.data?.summary
  const rooms = vacancy.data?.rooms ?? []
  useRealtimeAdmissions({ enabled: Boolean(organizationId) })

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization context missing"
        message="Vacancy management requires an organization assignment."
      />
    )
  }

  if (vacancy.isError) {
    return (
      <APIErrorState
        title="Vacancy could not be loaded"
        error={vacancy.error}
        onRetry={() => void vacancy.refetch()}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-blue-700">Admissions</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Live Vacancy
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Reservation-aware bed availability across occupied, held, and maintenance-blocked
          capacity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <VacancyMetric
          title="Total Capacity"
          value={summary?.total_beds ?? 0}
          icon={Building2}
        />
        <VacancyMetric
          title="Occupied"
          value={summary?.occupied_beds ?? 0}
          icon={BedDouble}
        />
        <VacancyMetric
          title="Reserved"
          value={summary?.reserved_beds ?? 0}
          icon={Clock}
        />
        <VacancyMetric
          title="Available"
          value={summary?.available_beds ?? 0}
          icon={Activity}
        />
        <VacancyMetric
          title="Maintenance"
          value={summary?.maintenance_blocked_beds ?? 0}
          icon={ShieldAlert}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <VacancyMetric
          title="New inquiries"
          value={analytics.data?.newInquiries ?? 0}
          icon={Activity}
        />
        <VacancyMetric
          title="Active reservations"
          value={analytics.data?.activeReservations ?? 0}
          icon={Clock}
        />
        <VacancyMetric
          title="Conversion rate"
          value={`${analytics.data?.conversionRate ?? 0}%`}
          icon={Building2}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Room-wise Availability</CardTitle>
          <CardDescription>
            Live calculations include current residents, active reservations, and maintenance holds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vacancy.isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-14 rounded-lg border bg-muted/50" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <EmptyState
              title="No room capacity found"
              message="Create rooms before vacancy can be calculated room by room."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Occupied</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Maintenance</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((room) => (
                    <TableRow key={room.room_id}>
                      <TableCell>
                        <div className="font-medium">{room.room_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {room.room_name ?? room.room_type}
                        </div>
                      </TableCell>
                      <TableCell>{room.total_beds}</TableCell>
                      <TableCell>{room.occupied_beds}</TableCell>
                      <TableCell>{room.reserved_beds}</TableCell>
                      <TableCell>{room.maintenance_blocked_beds}</TableCell>
                      <TableCell className="font-medium">{room.available_beds}</TableCell>
                      <TableCell>
                        <StatusBadge status={room.room_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {summary ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Last calculated {formatDateTime(summary.calculated_at)}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function VacancyMetric({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string | number
  icon: typeof Building2
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Icon className="size-5 text-blue-700" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
