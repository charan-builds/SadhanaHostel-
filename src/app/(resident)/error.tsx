"use client"

import { useEffect } from "react"

import { APIErrorState } from "@/components/system"

export default function ResidentError({
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
      Sentry.captureException(error, { tags: { route_area: "resident" } })
    })
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <APIErrorState
      title="Resident portal failed to load"
      message="Retry the request. If this continues, hostel support can trace it in monitoring."
      requestId={error.digest}
      onRetry={retry}
    />
  )
}
