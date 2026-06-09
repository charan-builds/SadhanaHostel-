import { RefreshCcw } from "lucide-react"

import { MotionReveal } from "@/components/shared/motion-reveal"
import { Button } from "@/components/ui/button"

export function RetryState({
  title = "Unable to load data",
  message = "Please try again.",
  onRetry,
}: {
  title?: string
  message?: string
  onRetry: () => void
}) {
  return (
    <MotionReveal>
      <div className="saas-surface rounded-xl p-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-warning-surface text-warning-foreground ring-1 ring-warning/20">
          <RefreshCcw className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
        <Button type="button" className="mt-5" size="sm" onClick={onRetry}>
          <RefreshCcw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    </MotionReveal>
  )
}
