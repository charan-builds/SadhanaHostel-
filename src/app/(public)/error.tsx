"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import { APIErrorState } from "@/components/system"

export default function PublicError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { route_area: "public" } })
  }, [error])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <APIErrorState
        title="Website section failed to load"
        message="Please retry. If this continues, the request has been captured for review."
        onRetry={reset}
      />
    </main>
  )
}
