import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

type LoadingStateProps = {
  variant?: "spinner" | "cards" | "table" | "dashboard"
  rows?: number
  className?: string
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/55 before:to-transparent",
        className
      )}
    />
  )
}

function CardSkeletons({ rows }: { rows: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="saas-surface rounded-xl p-4">
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="mt-3 h-8 w-1/2" />
          <SkeletonBlock className="mt-4 h-3 w-full" />
          <SkeletonBlock className="mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="saas-surface rounded-xl">
      <div className="grid grid-cols-4 gap-4 border-b p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-4 gap-4 border-b p-4 last:border-b-0">
          {Array.from({ length: 4 }).map((__, cellIndex) => (
            <SkeletonBlock key={cellIndex} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardSkeletons rows={4} />
      </div>
      <TableSkeleton rows={5} />
    </div>
  )
}

export function LoadingState({ variant = "spinner", rows = 3, className }: LoadingStateProps) {
  if (variant === "cards") {
    return (
      <div className={className}>
        <CardSkeletons rows={rows} />
      </div>
    )
  }

  if (variant === "table") {
    return (
      <div className={className}>
        <TableSkeleton rows={rows} />
      </div>
    )
  }

  if (variant === "dashboard") {
    return (
      <div className={className}>
        <DashboardSkeleton />
      </div>
    )
  }

  return (
    <div className={cn("saas-surface flex min-h-40 items-center justify-center rounded-xl", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span>Loading</span>
      </div>
    </div>
  )
}
