"use client"

import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { ConnectivityRecoveryBanner, ErrorBoundary } from "@/components/system"
import { AuthProvider } from "@/lib/auth"
import { AppQueryProvider } from "@/lib/react-query"
import { RealtimeProvider } from "@/lib/realtime"

import { MotionProvider } from "./motion-provider"
import { SentryContextSync } from "./sentry-context-sync"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <MotionProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </MotionProvider>
      <Toaster richColors closeButton />
    </AppQueryProvider>
  )
}

export function SessionProviders({
  children,
  loadSessionOnMount = true,
}: {
  children: ReactNode
  loadSessionOnMount?: boolean
}) {
  return (
    <AuthProvider loadSessionOnMount={loadSessionOnMount}>
      <SentryContextSync />
      <ConnectivityRecoveryBanner />
      <RealtimeProvider>{children}</RealtimeProvider>
    </AuthProvider>
  )
}
