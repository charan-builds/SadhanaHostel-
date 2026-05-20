"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import { useAuth } from "@/lib/auth"

type RealtimeContextValue = {
  organizationId: string | null
  defaultHostelId: string | null
  channelName: string | null
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { session, organizationId } = useAuth()
  const defaultHostelId = session?.hostelIds[0] ?? null
  const value = useMemo<RealtimeContextValue>(
    () => ({
      organizationId,
      defaultHostelId,
      channelName: organizationId ? buildTenantChannelName(organizationId) : null,
    }),
    [defaultHostelId, organizationId]
  )

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  )
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext)

  if (!context) {
    throw new Error("useRealtimeContext must be used inside RealtimeProvider.")
  }

  return context
}

export function buildTenantChannelName(organizationId: string, hostelId?: string | null) {
  return hostelId
    ? `tenant:${organizationId}:hostel:${hostelId}`
    : `tenant:${organizationId}:global`
}
