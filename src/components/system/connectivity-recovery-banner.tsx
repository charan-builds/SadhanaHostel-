"use client"

import Link from "next/link"
import type { Route } from "next"
import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

export function ConnectivityRecoveryBanner() {
  const { isAuthenticated, refreshSession } = useAuth()
  const [isOffline, setIsOffline] = useState(false)
  const [hadAuthenticatedSession, setHadAuthenticatedSession] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (isAuthenticated) {
        setHadAuthenticatedSession(true)
        setSessionExpired(false)
      } else if (hadAuthenticatedSession) {
        setSessionExpired(true)
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [hadAuthenticatedSession, isAuthenticated])

  useEffect(() => {
    function syncOnlineState() {
      setIsOffline(!navigator.onLine)

      if (navigator.onLine) {
        void refreshSession()
      }
    }

    function refreshOnFocus() {
      if (navigator.onLine && hadAuthenticatedSession) {
        void refreshSession()
      }
    }

    syncOnlineState()
    window.addEventListener("online", syncOnlineState)
    window.addEventListener("offline", syncOnlineState)
    window.addEventListener("focus", refreshOnFocus)

    return () => {
      window.removeEventListener("online", syncOnlineState)
      window.removeEventListener("offline", syncOnlineState)
      window.removeEventListener("focus", refreshOnFocus)
    }
  }, [hadAuthenticatedSession, refreshSession])

  if (!isOffline && !sessionExpired) {
    return null
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border bg-background p-3 shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">
              {isOffline ? "Connection lost" : "Session needs recovery"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isOffline
                ? "Your changes are safer if you wait until the connection returns, then retry."
                : "Your session may have expired. Sign in again to continue safely."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshSession()}>
            Retry
          </Button>
          {sessionExpired ? (
            <Button asChild size="sm">
              <Link href={"/login" as Route}>Login</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
