import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { MotionReveal } from "@/components/shared/motion-reveal"

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
      <article className="saas-surface motion-lift group rounded-xl">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 break-words text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {subtitle ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}
          </div>
          {Icon ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-105">
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
