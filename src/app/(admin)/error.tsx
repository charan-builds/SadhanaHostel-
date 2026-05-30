"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import { APIErrorState } from "@/components/system"

export default function AdminError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string }
  unstable_retry?: () => void
  reset?: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { route_area: "admin" } })
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <APIErrorState
      title="Admin workspace failed to load"
      message="Retry the request. If the error persists, check the captured request in monitoring."
      requestId={error.digest}
      onRetry={retry}
    />
  )
}
