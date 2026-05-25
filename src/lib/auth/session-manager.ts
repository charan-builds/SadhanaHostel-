"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { authSdk, type SessionOverview } from "@/sdk"

export async function loadSessionOverview() {
  return authSdk.session()
}

export function subscribeToSessionChanges(callback: () => void) {
  const supabase = createSupabaseBrowserClient()
  const { data } = supabase.auth.onAuthStateChange(() => {
    callback()
  })

  return () => data.subscription.unsubscribe()
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
