"use client"

import { useEffect, useState, type ComponentType } from "react"

type ToasterComponent = ComponentType<{
  richColors?: boolean
  closeButton?: boolean
}>
type InstallPromptComponent = ComponentType

export function AppClientEnhancements() {
  const [Toaster, setToaster] = useState<ToasterComponent | null>(null)
  const [PwaInstallPrompt, setPwaInstallPrompt] =
    useState<InstallPromptComponent | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return
    }

    let cancelled = false
    const cancelIdleCallback =
      "cancelIdleCallback" in window
        ? window.cancelIdleCallback.bind(window)
        : null
    const requestIdleCallback =
      "requestIdleCallback" in window
        ? window.requestIdleCallback.bind(window)
        : null

    function loadEnhancements() {
      void import("@/lib/pwa/client")
        .then(({ registerSadhanaServiceWorker }) =>
          registerSadhanaServiceWorker()
        )
        .catch(() => {
          // Service worker registration is a progressive enhancement.
        })

      void import("@/components/ui/sonner")
        .then((mod) => {
          if (!cancelled) {
            setToaster(() => mod.Toaster)
          }
        })
        .catch(() => {})

      void import("@/components/pwa/pwa-install-prompt")
        .then((mod) => {
          if (!cancelled) {
            setPwaInstallPrompt(() => mod.PwaInstallPrompt)
          }
        })
        .catch(() => {})
    }

    if (requestIdleCallback) {
      const idleId = requestIdleCallback(loadEnhancements, { timeout: 4000 })

      return () => {
        cancelled = true
        cancelIdleCallback?.(idleId)
      }
    }

    const timeoutId = window.setTimeout(loadEnhancements, 2500)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [])

  return (
    <>
      {PwaInstallPrompt ? <PwaInstallPrompt /> : null}
      {Toaster ? <Toaster richColors closeButton /> : null}
    </>
  )
}
