"use client"

import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/system"
import { AuthProvider } from "@/lib/auth"
import { AppQueryProvider } from "@/lib/react-query"
import { RealtimeProvider } from "@/lib/realtime"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <AuthProvider>
        <RealtimeProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </RealtimeProvider>
      </AuthProvider>
      <Toaster richColors closeButton />
    </AppQueryProvider>
  )
}
