import { History } from "lucide-react"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { MockRoomAllocation } from "@/types/frontend"

type RoomAllocationHistoryProps = {
  allocations: MockRoomAllocation[]
}

function formatDate(date?: string) {
  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function RoomAllocationHistory({ allocations }: RoomAllocationHistoryProps) {
  return (
    <DataTableShell
      title="Allocation History"
      description="Mock allocation movement for this room."
      empty={
        allocations.length === 0 ? (
          <EmptyState
            icon={History}
            title="No allocation history"
            description="Room allocation history will appear here after resident assignments."
          />
        ) : undefined
      }
    >
      {allocations.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>Allocated Date</TableHead>
                <TableHead>Vacated Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{allocation.residentName}</p>
                      <p className="text-xs text-muted-foreground">{allocation.residentId}</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(allocation.allocatedDate)}</TableCell>
                  <TableCell>{formatDate(allocation.vacatedDate)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-6 rounded-full px-2.5 capitalize",
                        allocation.status === "active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      )}
                    >
                      {allocation.status}
                    </Badge>
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
