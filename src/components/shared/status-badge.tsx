import { Badge } from "@/components/ui/badge"
import { humanizeEnum } from "@/lib/format"
import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  status: string
  className?: string
}

const statusStyles: Record<string, string> = {
  active: "border-success/25 bg-success-surface text-success-foreground",
  approved: "border-success/25 bg-success-surface text-success-foreground",
  available: "border-success/25 bg-success-surface text-success-foreground",
  paid: "border-success/25 bg-success-surface text-success-foreground",
  published: "border-success/25 bg-success-surface text-success-foreground",
  verified: "border-success/25 bg-success-surface text-success-foreground",
  pending: "border-warning/30 bg-warning-surface text-warning-foreground",
  draft: "border-warning/30 bg-warning-surface text-warning-foreground",
  initiated: "border-warning/30 bg-warning-surface text-warning-foreground",
  issued: "border-warning/30 bg-warning-surface text-warning-foreground",
  verification_pending: "border-warning/30 bg-warning-surface text-warning-foreground",
  partial: "border-info/25 bg-info-surface text-info-foreground",
  partially_paid: "border-info/25 bg-info-surface text-info-foreground",
  partially_refunded: "border-info/25 bg-info-surface text-info-foreground",
  departed: "border-info/25 bg-info-surface text-info-foreground",
  maintenance: "border-info/25 bg-info-surface text-info-foreground",
  full: "border-info/25 bg-info-surface text-info-foreground",
  archived: "border-border bg-muted text-muted-foreground",
  cancelled: "border-border bg-muted text-muted-foreground",
  checked_out: "border-border bg-muted text-muted-foreground",
  inactive: "border-border bg-muted text-muted-foreground",
  left: "border-border bg-muted text-muted-foreground",
  refunded: "border-border bg-muted text-muted-foreground",
  returned: "border-border bg-muted text-muted-foreground",
  suspended: "border-destructive/25 bg-destructive/10 text-destructive",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
  rejected: "border-destructive/25 bg-destructive/10 text-destructive",
  overdue: "border-destructive/25 bg-destructive/10 text-destructive",
}

const statusLabels: Record<string, string> = {
  active: "Active",
  approved: "Approved",
  available: "Available",
  archived: "Archived",
  cancelled: "Cancelled",
  checked_out: "Left Hostel",
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
        statusStyles[status] ?? "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      {statusLabels[status] ?? humanizeEnum(status)}
    </Badge>
  )
}
