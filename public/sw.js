const CACHE_VERSION = "sadhana-pwa-v1"
const STATIC_CACHE = `${CACHE_VERSION}:static`
const TENANT_CACHE = `${CACHE_VERSION}:tenant`
const STATIC_ASSETS = [
  "/",
  "/login",
  "/resident/login",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
]
const OFFLINE_PAGE_PATHS = new Set([
  "/resident/dashboard",
  "/resident/notices",
  "/resident/profile",
])
const OFFLINE_API_PREFIXES = [
  "/api/auth/session",
  "/api/residents/me",
  "/api/notices",
  "/api/payments/ledger",
  "/api/onboarding/me",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_AUTH_CACHES") {
    event.waitUntil(clearTenantCaches())
  }
})

self.addEventListener("fetch", (event) => {
  const request = event.request

  if (request.method !== "GET") {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  if (OFFLINE_PAGE_PATHS.has(url.pathname)) {
    event.respondWith(networkFirst(request, TENANT_CACHE))
    return
  }

  if (OFFLINE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(networkFirst(request, TENANT_CACHE))
    return
  }

  if (
    url.pathname === "/" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon" ||
    url.pathname.startsWith("/pwa-icon/")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  }
})

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event)
  const data = payload.data || {}
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/pwa-icon/192",
    badge: payload.badge || "/pwa-icon/96",
    tag: payload.tag || data.notificationId || "sadhana-hostel",
    renotify: Boolean(payload.renotify),
    requireInteraction: payload.priority === "critical",
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [],
    data: {
      url: data.url || "/resident/dashboard",
      actions: data.actions || {},
      notificationId: data.notificationId || null,
      createdAt: Date.now(),
    },
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Sadhana Boys Hostel", options)
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const actionUrl = event.action && data.actions ? data.actions[event.action] : null
  const targetUrl = new URL(actionUrl || data.url || "/resident/dashboard", self.location.origin)

  event.waitUntil(openOrFocusClient(targetUrl.href))
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)

  try {
    const response = await fetch(request)

    if (response.ok && canCacheResponse(response)) {
      await cache.put(request, response.clone())
    }

    return response
  } catch {
    const cached = await cache.match(request)

    if (cached) {
      return cached
    }

    if (request.mode === "navigate") {
      return caches.match("/resident/login")
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "OFFLINE",
          message: "You are offline and no cached copy is available.",
        },
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json",
        },
      }
    )
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (response.ok && canCacheResponse(response)) {
    await cache.put(request, response.clone())
  }

  return response
}

function canCacheResponse(response) {
  return response.type === "basic" || response.type === "default"
}

function readPushPayload(event) {
  if (!event.data) {
    return {}
  }

  try {
    return event.data.json()
  } catch {
    return {
      title: "Sadhana Boys Hostel",
      body: event.data.text(),
    }
  }
}

async function openOrFocusClient(url) {
  const windowClients = await clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  })

  for (const client of windowClients) {
    if ("focus" in client && new URL(client.url).origin === self.location.origin) {
      await client.focus()
      return client.navigate(url)
    }
  }

  return clients.openWindow(url)
}

async function clearTenantCaches() {
  await caches.delete(TENANT_CACHE)
}
