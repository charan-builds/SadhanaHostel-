import { Button } from "@/components/ui/button"

export function APIErrorState({
  title = "Something went wrong",
  message,
  requestId,
  onRetry,
}: {
  title?: string
  message?: string
  requestId?: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {requestId ? (
          <p className="text-xs text-muted-foreground">Request ID: {requestId}</p>
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
