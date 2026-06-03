"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { FrontendApiError } from "@/lib/api-client"
import { authSdk, type SessionOverview } from "@/sdk"

const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-[^=;\s]+-auth-token(?:\.\d+)?$/

export async function loadSessionOverview() {
  try {
    return await authSdk.session()
  } catch (error) {
    if (error instanceof FrontendApiError && isAnonymousSessionStatus(error.status)) {
      return anonymousSessionOverview()
    }

    throw error
  }
}

export function hasBrowserSupabaseSessionCookie() {
  if (typeof document === "undefined") {
    return false
  }

  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .some((cookieName) => SUPABASE_AUTH_COOKIE_PATTERN.test(cookieName))
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
    redirectTo: "/admin/login",
    security: {
      forcePasswordReset: false,
      temporaryPasswordActive: false,
      temporaryPasswordExpiresAt: null,
    },
  }
}

function isAnonymousSessionStatus(status: number) {
  return status === 401 || status === 404
}

export function resolveHomeRoute(session: SessionOverview | null) {
  if (!session?.authenticated) {
    return "/admin/login"
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
