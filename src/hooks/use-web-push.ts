"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { registerSadhanaServiceWorker } from "@/lib/pwa/client"
import { notificationsSdk } from "@/sdk"

type WebPushParams = {
  organizationId?: string | null
  hostelId?: string | null
  enabled?: boolean
}

export function useWebPushSubscription(params: WebPushParams) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const enabled = Boolean(params.enabled && params.organizationId)
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    queueMicrotask(() => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window &&
        Boolean(publicKey)

      setIsSupported(supported)
      setPermission("Notification" in window ? Notification.permission : "denied")

      if (!supported) {
        return
      }

      void registerSadhanaServiceWorker()
        .then((registration) => registration?.pushManager.getSubscription())
        .then((currentSubscription) => {
          setSubscription(currentSubscription ?? null)
        })
        .catch(() => {
          setSubscription(null)
        })
    })
  }, [enabled, publicKey])

  const subscribe = useCallback(async () => {
    if (!enabled || !params.organizationId || !publicKey) {
      toast.error("Push notifications are not configured yet.")
      return
    }

    setIsBusy(true)

    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)

      if (nextPermission !== "granted") {
        toast.error("Notification permission was not granted.")
        return
      }

      const registration = await registerSadhanaServiceWorker()
      const readyRegistration = registration ?? (await navigator.serviceWorker.ready)
      const nextSubscription = await readyRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await notificationsSdk.subscribePush({
        organizationId: params.organizationId,
        hostelId: params.hostelId ?? undefined,
        subscription: nextSubscription.toJSON() as {
          endpoint: string
          expirationTime?: number | null
          keys: { p256dh: string; auth: string }
        },
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      })

      setSubscription(nextSubscription)
      toast.success("Push notifications enabled.")
    } catch {
      toast.error("Unable to enable push notifications.")
    } finally {
      setIsBusy(false)
    }
  }, [enabled, params.hostelId, params.organizationId, publicKey])

  const unsubscribe = useCallback(async () => {
    setIsBusy(true)

    try {
      const currentSubscription =
        subscription ??
        (await navigator.serviceWorker.ready
          .then((registration) => registration.pushManager.getSubscription())
          .catch(() => null))

      if (currentSubscription) {
        await currentSubscription.unsubscribe()
        await notificationsSdk.revokePush({ endpoint: currentSubscription.endpoint })
      } else {
        await notificationsSdk.revokePush({})
      }

      setSubscription(null)
      toast.success("Push notifications disabled.")
    } catch {
      toast.error("Unable to disable push notifications.")
    } finally {
      setIsBusy(false)
    }
  }, [subscription])

  return useMemo(
    () => ({
      isSupported,
      isConfigured: Boolean(publicKey),
      isSubscribed: Boolean(subscription),
      permission,
      isBusy,
      subscribe,
      unsubscribe,
    }),
    [isBusy, isSupported, permission, publicKey, subscribe, subscription, unsubscribe]
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}
