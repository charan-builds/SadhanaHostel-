import { Badge } from "@/components/ui/badge"
import { humanizeEnum } from "@/lib/format"
import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  status: string
  className?: string
}

const statusStyles: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  initiated: "border-amber-200 bg-amber-50 text-amber-700",
  issued: "border-amber-200 bg-amber-50 text-amber-700",
  verification_pending: "border-amber-200 bg-amber-50 text-amber-700",
  partial: "border-blue-200 bg-blue-50 text-blue-700",
  partially_paid: "border-blue-200 bg-blue-50 text-blue-700",
  partially_refunded: "border-blue-200 bg-blue-50 text-blue-700",
  departed: "border-blue-200 bg-blue-50 text-blue-700",
  maintenance: "border-blue-200 bg-blue-50 text-blue-700",
  full: "border-blue-200 bg-blue-50 text-blue-700",
  archived: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
  checked_out: "border-slate-200 bg-slate-50 text-slate-600",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
  left: "border-slate-200 bg-slate-50 text-slate-600",
  refunded: "border-slate-200 bg-slate-50 text-slate-600",
  returned: "border-slate-200 bg-slate-50 text-slate-600",
  suspended: "border-red-200 bg-red-50 text-red-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
}

const statusLabels: Record<string, string> = {
  active: "Active",
  approved: "Approved",
  available: "Available",
  archived: "Archived",
  cancelled: "Cancelled",
  checked_out: "Checked Out",
  departed: "Departed",
  draft: "Draft",
  failed: "Failed",
  full: "Full",
  inactive: "Inactive",
  initiated: "Initiated",
  issued: "Issued",
  left: "Left",
  maintenance: "Maintenance",
  overdue: "Overdue",
  paid: "Paid",
  partial: "Partial",
  partially_paid: "Partially Paid",
  partially_refunded: "Partially Refunded",
  pending: "Pending",
  published: "Published",
  rejected: "Rejected",
  refunded: "Refunded",
  returned: "Returned",
  suspended: "Suspended",
  verified: "Verified",
  verification_pending: "Verification Pending",
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-full px-2.5 capitalize",
        statusStyles[status] ?? "border-slate-200 bg-slate-50 text-slate-600",
        className
      )}
    >
      {statusLabels[status] ?? humanizeEnum(status)}
    </Badge>
  )
}
