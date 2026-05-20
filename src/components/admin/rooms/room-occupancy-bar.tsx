import { cn } from "@/lib/utils"

type RoomOccupancyBarProps = {
  capacity: number
  occupiedCount: number
  className?: string
  showLabel?: boolean
}

export function getRoomOccupancyPercent(capacity: number, occupiedCount: number) {
  if (capacity <= 0) {
    return 0
  }

  return Math.min(100, Math.round((occupiedCount / capacity) * 100))
}

export function RoomOccupancyBar({
  capacity,
  occupiedCount,
  className,
  showLabel = true,
}: RoomOccupancyBarProps) {
  const occupancyPercent = getRoomOccupancyPercent(capacity, occupiedCount)
  const availableBeds = Math.max(capacity - occupiedCount, 0)

  return (
    <div className={cn("grid gap-2", className)}>
      {showLabel ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {occupiedCount}/{capacity} occupied
          </span>
          <span>{availableBeds} available</span>
        </div>
      ) : null}
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="Room occupancy"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={occupancyPercent}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            occupancyPercent >= 100
              ? "bg-blue-700"
              : occupancyPercent >= 75
                ? "bg-amber-500"
                : "bg-emerald-600",
          )}
          style={{ width: `${occupancyPercent}%` }}
        />
      </div>
    </div>
  )
}
