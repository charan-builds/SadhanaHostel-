import type { ReactNode } from "react"

import { MotionReveal } from "@/components/shared/motion-reveal"
import { cn } from "@/lib/utils"

type DataTableShellProps = {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  empty?: ReactNode
  className?: string
}

export function DataTableShell({
  title,
  description,
  actions,
  children,
  footer,
  empty,
  className,
}: DataTableShellProps) {
  return (
    <MotionReveal className={className}>
    <section className="saas-surface overflow-hidden rounded-xl">
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b bg-white/45 p-4 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div> : null}
        </div>
      )}
      <div>{empty ?? children}</div>
      {footer ? <div className="border-t bg-muted/40 p-4">{footer}</div> : null}
    </section>
    </MotionReveal>
  )
}
