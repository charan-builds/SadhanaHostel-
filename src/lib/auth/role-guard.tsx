"use client"

import type { ReactNode } from "react"

import { APIErrorState, GlobalLoader } from "@/components/system"
import type { AppRole } from "@/constants/auth"

import { useAuth } from "./auth-provider"

export function RoleGuard({
  allowedRoles,
  children,
  fallback,
}: {
  allowedRoles: readonly AppRole[]
  children: ReactNode
  fallback?: ReactNode
}) {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return <GlobalLoader />
  }

  const allowed = session?.roles.some((role) => allowedRoles.includes(role))

  if (!allowed) {
    return (
      fallback ?? (
        <APIErrorState
          title="Access restricted"
          message="You do not have permission to view this page."
        />
      )
    )
  }

  return <>{children}</>
}
