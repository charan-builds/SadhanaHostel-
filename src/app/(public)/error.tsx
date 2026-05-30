"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import { APIErrorState } from "@/components/system"

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
    Sentry.captureException(error, { tags: { route_area: "public" } })
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <APIErrorState
        title="Website section failed to load"
        message="Please retry. If this continues, the request has been captured for review."
        requestId={error.digest}
        onRetry={retry}
      />
    </main>
  )
}
