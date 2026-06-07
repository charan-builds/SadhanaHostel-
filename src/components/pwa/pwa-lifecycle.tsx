"use client"

import { useEffect } from "react"

import { registerSadhanaServiceWorker } from "@/lib/pwa/client"

export function PwaLifecycle() {
  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return
    }

    void registerSadhanaServiceWorker().catch(() => {
      // Service worker registration is a progressive enhancement.
    })
  }, [])

  return null
}
