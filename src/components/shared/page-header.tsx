import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { MotionReveal } from "@/components/shared/motion-reveal"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  badge?: string
  actions?: ReactNode
  breadcrumbs?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <MotionReveal>
      <header className={cn("grid gap-4 md:grid-cols-[1fr_auto] md:items-start", className)}>
        <div className="min-w-0">
          {breadcrumbs ? <div className="mb-3 text-sm text-muted-foreground">{breadcrumbs}</div> : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-gradient text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              {title}
            </h1>
            {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          </div>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2 sm:[&>*]:w-auto md:justify-end">
            {actions}
          </div>
        ) : null}
      </header>
    </MotionReveal>
  )
}
