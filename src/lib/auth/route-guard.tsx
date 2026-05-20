"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, type ReactNode } from "react"

import {
  AUTH_REDIRECTS,
  PROTECTED_ROUTE_POLICIES,
  type AppRole,
  type ProtectedRouteArea,
} from "@/constants/auth"
import { GlobalLoader } from "@/components/system"

import { useAuth } from "./auth-provider"

export function RouteGuard({
  area,
  children,
}: {
  area: ProtectedRouteArea
  children: ReactNode
}) {
  const { session, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const replaceRoute = useCallback(
    (path: string) => {
      router.replace(path as Parameters<typeof router.replace>[0])
    },
    [router]
  )
  const policy = PROTECTED_ROUTE_POLICIES[area]
  const isAuthenticated = Boolean(session?.authenticated)
  const allowedRoles = policy.allowedRoles as readonly AppRole[]
  const isAllowed = Boolean(
    session?.roles.some((role) => allowedRoles.includes(role))
  )

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!isAuthenticated) {
      replaceRoute(`${policy.loginPath}?next=${encodeURIComponent(pathname)}`)
      return
    }

    if (session?.onboardingRequired) {
      replaceRoute(session.redirectTo || AUTH_REDIRECTS.unauthorized)
      return
    }

    if (!isAllowed) {
      replaceRoute(policy.unauthorizedPath)
    }
  }, [
    isAllowed,
    isAuthenticated,
    isLoading,
    pathname,
    policy.loginPath,
    policy.unauthorizedPath,
    replaceRoute,
    session?.onboardingRequired,
    session?.redirectTo,
  ])

  if (isLoading || !isAuthenticated || !isAllowed) {
    return <GlobalLoader />
  }

  return <>{children}</>
}
