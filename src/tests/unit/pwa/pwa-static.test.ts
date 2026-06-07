import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import manifest from "@/app/manifest"

function projectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("PWA install and offline contracts", () => {
  it("ships an installable resident-first manifest", () => {
    const appManifest = manifest()

    expect(appManifest.display).toBe("standalone")
    expect(appManifest.start_url).toBe("/resident/dashboard")
    expect(appManifest.scope).toBe("/")
    expect(appManifest.theme_color).toBe("#0068b7")
    expect(appManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/pwa-icon/192",
          sizes: "192x192",
          purpose: "maskable",
        }),
        expect.objectContaining({
          src: "/pwa-icon/512",
          sizes: "512x512",
          purpose: "maskable",
        }),
      ])
    )
    expect(appManifest.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "/resident/payments" }),
        expect.objectContaining({ url: "/resident/notices" }),
      ])
    )
  })

  it("caches resident dashboard, notices, profile, and ledger routes offline", () => {
    const serviceWorker = projectFile("public/sw.js")

    expect(serviceWorker).toContain("/resident/dashboard")
    expect(serviceWorker).toContain("/resident/notices")
    expect(serviceWorker).toContain("/resident/profile")
    expect(serviceWorker).toContain("/api/residents/me")
    expect(serviceWorker).toContain("/api/notices")
    expect(serviceWorker).toContain("/api/payments/ledger")
    expect(serviceWorker).toContain("CLEAR_AUTH_CACHES")
  })

  it("supports push notification actions for invoices, payments, and notices", () => {
    const serviceWorker = projectFile("public/sw.js")
    const webPushService = projectFile("src/services/pwa/web-push.service.ts")

    expect(serviceWorker).toContain("notificationclick")
    expect(webPushService).toContain("view_invoice")
    expect(webPushService).toContain("pay_now")
    expect(webPushService).toContain("open_notice")
    expect(webPushService).toContain("VAPID_PRIVATE_KEY")
  })

  it("revokes push subscriptions and clears PWA caches on logout", () => {
    const authService = projectFile("src/services/auth.service.ts")
    const dashboardActions = projectFile("src/components/layout/dashboard-user-actions.tsx")

    expect(authService).toContain("revokeCurrentUserPushSubscriptions")
    expect(authService).toContain("PushSubscriptionsRepository")
    expect(dashboardActions).toContain("clearPwaTenantState")
  })
})
