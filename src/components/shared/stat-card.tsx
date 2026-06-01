import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { MotionReveal } from "@/components/shared/motion-reveal"
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
    <MotionReveal className={className}>
      <article className="saas-surface motion-lift group rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
          {Icon ? (
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105", toneClassName[tone])}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
          {trend ? <div className="text-sm font-medium text-foreground">{trend}</div> : null}
        </div>
      </article>
    </MotionReveal>
  )
}
