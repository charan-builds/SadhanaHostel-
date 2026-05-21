"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

import { useAuth } from "@/lib/auth"

export function SentryContextSync() {
  const { session, organizationId } = useAuth()

  useEffect(() => {
    if (!session?.authenticated) {
      Sentry.setUser(null)
      Sentry.setTag("tenant_id", "anonymous")
      Sentry.setTag("role", "anonymous")
      return
    }

    Sentry.setUser({
      id: session.user?.id,
      email: session.user?.email,
    })
    Sentry.setTag("tenant_id", organizationId ?? "unassigned")
    Sentry.setTag("role", session.primaryRole ?? "unknown")
    Sentry.setContext("tenant", {
      organizationId,
      hostelIds: session.hostelIds,
    })
  }, [organizationId, session])

  return null
}
