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
    <div className="rounded-lg border p-6 text-center">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button className="mt-4" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
