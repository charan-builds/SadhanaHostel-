import type { ReactNode } from "react"

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
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
