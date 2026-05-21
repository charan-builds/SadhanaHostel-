"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import { APIErrorState } from "@/components/system"

export default function ResidentError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { route_area: "resident" } })
  }, [error])

  return (
    <APIErrorState
      title="Resident portal failed to load"
      message="Retry the request. If this continues, hostel support can trace it in monitoring."
      onRetry={reset}
    />
  )
}
