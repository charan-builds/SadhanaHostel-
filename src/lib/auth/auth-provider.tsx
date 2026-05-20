"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import type { SessionOverview } from "@/sdk"

import {
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
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: loadSessionOverview,
    staleTime: 30_000,
    retry: false,
  })

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
  }, [queryClient])

  useEffect(() => subscribeToSessionChanges(refreshSession), [refreshSession])

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.")
  }

  return context
}
