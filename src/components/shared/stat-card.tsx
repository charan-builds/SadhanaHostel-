import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type StatCardProps = {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "info"
  className?: string
}

const toneClassName = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
} as const

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <article className={cn("rounded-xl border bg-background p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("flex size-10 items-center justify-center rounded-lg", toneClassName[tone])}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {trend ? <div className="text-sm font-medium text-foreground">{trend}</div> : null}
      </div>
    </article>
  )
}
