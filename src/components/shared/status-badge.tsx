import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FrontendStatus } from "@/types/frontend"

type StatusBadgeProps = {
  status: FrontendStatus
  className?: string
}

const statusStyles: Record<FrontendStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  verification_pending: "border-amber-200 bg-amber-50 text-amber-700",
  partial: "border-blue-200 bg-blue-50 text-blue-700",
  maintenance: "border-blue-200 bg-blue-50 text-blue-700",
  full: "border-blue-200 bg-blue-50 text-blue-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
  left: "border-slate-200 bg-slate-50 text-slate-600",
  returned: "border-slate-200 bg-slate-50 text-slate-600",
  suspended: "border-red-200 bg-red-50 text-red-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
}

const statusLabels: Record<FrontendStatus, string> = {
  active: "Active",
  approved: "Approved",
  available: "Available",
  cancelled: "Cancelled",
  failed: "Failed",
  full: "Full",
  inactive: "Inactive",
  left: "Left",
  maintenance: "Maintenance",
  overdue: "Overdue",
  paid: "Paid",
  partial: "Partial",
  pending: "Pending",
  rejected: "Rejected",
  returned: "Returned",
  suspended: "Suspended",
  verification_pending: "Verification Pending",
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 rounded-full px-2.5 capitalize", statusStyles[status], className)}
    >
      {statusLabels[status]}
    </Badge>
  )
}
