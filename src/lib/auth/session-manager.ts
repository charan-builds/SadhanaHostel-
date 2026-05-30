"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { FrontendApiError } from "@/lib/api-client"
import { authSdk, type SessionOverview } from "@/sdk"

export async function loadSessionOverview() {
  try {
    return await authSdk.session()
  } catch (error) {
    if (error instanceof FrontendApiError && error.status === 401) {
      return anonymousSessionOverview()
    }

    throw error
  }
}

export function subscribeToSessionChanges(callback: (event: string) => void) {
  const supabase = createSupabaseBrowserClient()
  let timeout: ReturnType<typeof setTimeout> | null = null
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      callback(event)
    }, 0)
  })

  return () => {
    if (timeout) {
      clearTimeout(timeout)
    }

    data.subscription.unsubscribe()
  }
}

export function anonymousSessionOverview(): SessionOverview {
  return {
    authenticated: false,
    user: null,
    profile: null,
    roles: [],
    primaryRole: null,
    organizationId: null,
    hostelIds: [],
    onboardingRequired: false,
    redirectTo: "/login",
  }
}

export function resolveHomeRoute(session: SessionOverview | null) {
  if (!session?.authenticated) {
    return "/login"
  }

  if (session.onboardingRequired && session.redirectTo) {
    return session.redirectTo
  }

  if (session.roles.includes("super_admin") || session.roles.includes("admin") || session.roles.includes("owner")) {
    return "/admin/dashboard"
  }

  if (session.roles.includes("resident")) {
    return "/resident/dashboard"
  }

  return session.redirectTo || "/"
}
