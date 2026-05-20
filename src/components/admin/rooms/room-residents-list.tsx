import Link from "next/link"
import type { Route } from "next"
import { Users } from "lucide-react"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MockResident } from "@/types/frontend"

type RoomResidentsListProps = {
  residents: MockResident[]
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function RoomResidentsList({ residents }: RoomResidentsListProps) {
  return (
    <DataTableShell
      title="Current Residents"
      description="Residents currently assigned to this room in mock data."
      empty={
        residents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No current residents"
            description="Assigned residents will appear here after allocation."
          />
        ) : undefined
      }
    >
      {residents.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Fee Status</TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents.map((resident) => (
                <TableRow key={resident.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{resident.name}</p>
                      <p className="text-xs text-muted-foreground">{resident.id}</p>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{resident.residentType}</TableCell>
                  <TableCell>{resident.phone}</TableCell>
                  <TableCell>
                    <StatusBadge status={resident.paymentStatus} />
                  </TableCell>
                  <TableCell>{formatDate(resident.joiningDate)}</TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/residents/${resident.id}` as Route}>View Resident</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </DataTableShell>
  )
}
