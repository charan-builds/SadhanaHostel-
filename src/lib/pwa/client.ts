"use client"

export async function registerSadhanaServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return null
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  })

  return registration
}

export async function clearPwaTenantState() {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready.catch(() => null)
    registration?.active?.postMessage({ type: "CLEAR_AUTH_CACHES" })
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_AUTH_CACHES" })
  }

  if ("caches" in window) {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.includes(":tenant"))
        .map((key) => caches.delete(key))
    )
  }
}

export function isStandalonePwa() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}
