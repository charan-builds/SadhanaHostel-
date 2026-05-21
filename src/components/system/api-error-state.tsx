import { Button } from "@/components/ui/button"

export function APIErrorState({
  title = "Something went wrong",
  error,
  message,
  requestId,
  onRetry,
}: {
  title?: string
  error?: unknown
  message?: string
  requestId?: string
  onRetry?: () => void
}) {
  const resolvedMessage = message ?? getErrorMessage(error)
  const resolvedRequestId = requestId ?? getRequestId(error)

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {resolvedMessage ? (
          <p className="text-sm text-muted-foreground">{resolvedMessage}</p>
        ) : null}
        {resolvedRequestId ? (
          <p className="text-xs text-muted-foreground">Request ID: {resolvedRequestId}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
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
