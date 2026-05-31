import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { MotionReveal } from "@/components/shared/motion-reveal"
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
    <MotionReveal className={className}>
    <article className="saas-surface group rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_-42px_rgba(15,23,42,0.7)]">
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-105">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {children ? <div className="px-5 pb-5">{children}</div> : null}
      {footer ? <div className="border-t bg-muted/40 px-5 py-3">{footer}</div> : null}
    </article>
    </MotionReveal>
  )
}
