"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { subscribeToApiAuthFailures } from "@/lib/api-client"
import { queryKeys } from "@/lib/react-query"
import type { SessionOverview } from "@/sdk"

import {
  anonymousSessionOverview,
  loadSessionOverview,
  subscribeToSessionChanges,
} from "./session-manager"

type AuthContextValue = {
  session: SessionOverview | null
  isLoading: boolean
  isAuthenticated: boolean
  organizationId: string | null
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const previousOrganizationId = useRef<string | null>(null)
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: loadSessionOverview,
    staleTime: 30_000,
    retry: false,
  })

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
  }, [queryClient])

  const clearTenantQueries = useCallback(() => {
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] === "tenant",
    })
  }, [queryClient])

  useEffect(
    () =>
      subscribeToSessionChanges((event) => {
        if (event === "SIGNED_OUT" || event === "USER_DELETED") {
          queryClient.setQueryData(queryKeys.auth.session, anonymousSessionOverview())
          clearTenantQueries()
        }

        void refreshSession()
      }),
    [clearTenantQueries, queryClient, refreshSession]
  )

  useEffect(
    () =>
      subscribeToApiAuthFailures(() => {
        queryClient.setQueryData(queryKeys.auth.session, anonymousSessionOverview())
        clearTenantQueries()
        void refreshSession()
      }),
    [clearTenantQueries, queryClient, refreshSession]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session: sessionQuery.data ?? null,
      isLoading: sessionQuery.isLoading,
      isAuthenticated: Boolean(sessionQuery.data?.authenticated),
      organizationId: sessionQuery.data?.organizationId ?? null,
      refreshSession,
    }),
    [refreshSession, sessionQuery.data, sessionQuery.isLoading]
  )

  useEffect(() => {
    const currentOrganizationId = value.organizationId
    const previous = previousOrganizationId.current

    if (previous && previous !== currentOrganizationId) {
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === "tenant" && query.queryKey[1] === previous,
      })
    }

    previousOrganizationId.current = currentOrganizationId
  }, [queryClient, value.organizationId])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.")
  }

  return context
}
