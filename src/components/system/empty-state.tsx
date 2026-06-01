import type { ReactNode } from "react"
import { Inbox } from "lucide-react"

import { MotionReveal } from "@/components/shared/motion-reveal"

export function EmptyState({
  title = "No data found",
  message,
  action,
}: {
  title?: string
  message?: string
  action?: ReactNode
}) {
  return (
    <MotionReveal>
      <div className="saas-surface rounded-xl border-dashed p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
          <Inbox className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        {message ? (
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {message}
          </p>
        ) : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </MotionReveal>
  )
}
