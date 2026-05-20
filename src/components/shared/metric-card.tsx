import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type MetricCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  children,
  footer,
  className,
}: MetricCardProps) {
  return (
    <article className={cn("rounded-xl border bg-background shadow-sm", className)}>
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {children ? <div className="px-5 pb-5">{children}</div> : null}
      {footer ? <div className="border-t bg-muted/40 px-5 py-3">{footer}</div> : null}
    </article>
  )
}
