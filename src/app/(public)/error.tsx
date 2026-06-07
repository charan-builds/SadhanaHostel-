"use client"

import { useEffect } from "react"

export default function PublicError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string }
  unstable_retry?: () => void
  reset?: () => void
}) {
  useEffect(() => {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error, { tags: { route_area: "public" } })
    })
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <main className="mx-auto flex min-h-[60svh] w-full max-w-3xl items-center px-4 py-12">
      <section className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm font-medium text-destructive">Website section failed to load</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Please retry</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          If this continues, the request has been captured for review.
        </p>
        {error.digest ? (
          <p className="mt-4 text-xs text-muted-foreground">Request ID: {error.digest}</p>
        ) : null}
        {retry ? (
          <button
            type="button"
            className="mt-6 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            onClick={retry}
          >
            Retry
          </button>
        ) : null}
      </section>
    </main>
  )
}
