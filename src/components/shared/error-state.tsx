import type { ReactNode } from "react"
import { CircleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

type ErrorStateProps = {
  title: string
  description?: string
  retryAction?: ReactNode
  className?: string
}

export function ErrorState({ title, description, retryAction, className }: ErrorStateProps) {
  return (
    <div className={cn("rounded-xl border bg-background p-8 text-center", className)} role="alert">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <CircleAlert className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {retryAction ? <div className="mt-5 flex justify-center">{retryAction}</div> : null}
    </div>
  )
}
