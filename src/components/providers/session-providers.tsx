"use client"

import type { ReactNode } from "react"

import { ConnectivityRecoveryBanner } from "@/components/system"
import { AuthProvider } from "@/lib/auth"
import { AppQueryProvider } from "@/lib/react-query"
import { RealtimeProvider } from "@/lib/realtime"

import { AppClientEnhancements } from "./app-client-enhancements"
import { SentryContextSync } from "./sentry-context-sync"

export function SessionProviders({
  children,
  loadSessionOnMount = true,
}: {
  children: ReactNode
  loadSessionOnMount?: boolean
}) {
  return (
    <AppQueryProvider>
      <AuthProvider loadSessionOnMount={loadSessionOnMount}>
        <SentryContextSync />
        <ConnectivityRecoveryBanner />
        <RealtimeProvider>{children}</RealtimeProvider>
        <AppClientEnhancements />
      </AuthProvider>
    </AppQueryProvider>
  )
}
