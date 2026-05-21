"use client"

import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/system"
import { AuthProvider } from "@/lib/auth"
import { AppQueryProvider } from "@/lib/react-query"
import { RealtimeProvider } from "@/lib/realtime"

import { SentryContextSync } from "./sentry-context-sync"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
      <Toaster richColors closeButton />
    </AppQueryProvider>
  )
}

export function SessionProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SentryContextSync />
      <RealtimeProvider>{children}</RealtimeProvider>
    </AuthProvider>
  )
}
