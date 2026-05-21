"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import { APIErrorState } from "@/components/system"

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { route_area: "admin" } })
  }, [error])

  return (
    <APIErrorState
      title="Admin workspace failed to load"
      message="Retry the request. If the error persists, check the captured request in monitoring."
      onRetry={reset}
    />
  )
}
