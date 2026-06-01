import type { ReactNode } from "react"
import { AlertTriangle, RefreshCcw } from "lucide-react"

import { MotionReveal } from "@/components/shared/motion-reveal"
import { Button } from "@/components/ui/button"

export function APIErrorState({
  title = "Something went wrong",
  error,
  message,
  requestId,
  onRetry,
  action,
}: {
  title?: string
  error?: unknown
  message?: string
  requestId?: string
  onRetry?: () => void
  action?: ReactNode
}) {
  const resolvedMessage = message ?? getErrorMessage(error)
  const resolvedRequestId = requestId ?? getRequestId(error)

  return (
    <MotionReveal>
    <div
      className="saas-surface rounded-xl border-destructive/25 bg-destructive/5 p-5"
      role="alert"
    >
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-destructive/15">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-2">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {resolvedMessage ? (
          <p className="text-sm leading-6 text-muted-foreground">{resolvedMessage}</p>
        ) : null}
        {resolvedRequestId ? (
          <p className="text-xs text-muted-foreground">Request ID: {resolvedRequestId}</p>
        ) : null}
        </div>
      </div>
      {onRetry || action ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCcw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
    </MotionReveal>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

function getRequestId(error: unknown) {
  if (!error || typeof error !== "object" || !("requestId" in error)) {
    return undefined
  }

  const requestId = (error as { requestId?: unknown }).requestId

  return typeof requestId === "string" ? requestId : undefined
}
