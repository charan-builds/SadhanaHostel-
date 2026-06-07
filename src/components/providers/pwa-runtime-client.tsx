"use client"

import { useEffect } from "react"

import { registerSadhanaServiceWorker } from "@/lib/pwa/client"

export function PwaRuntimeClient() {
  useEffect(() => {
    void registerSadhanaServiceWorker().catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Sadhana service worker registration failed.", error)
      }
    })
  }, [])

  return null
}
