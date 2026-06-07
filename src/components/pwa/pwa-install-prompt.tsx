"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Download, Share, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isStandalonePwa } from "@/lib/pwa/client"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISS_KEY = "sadhana:pwa-install-dismissed"

export function PwaInstallPrompt() {
  const pathname = usePathname()
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIosInstall, setIsIosInstall] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const bottomClass = useMemo(
    () =>
      pathname?.startsWith("/resident")
        ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
        : "bottom-[calc(5rem+env(safe-area-inset-bottom))]",
    [pathname]
  )

  useEffect(() => {
    if (isStandalonePwa()) {
      return
    }

    queueMicrotask(() => {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "true")

      const userAgent = window.navigator.userAgent.toLowerCase()
      const isIos = /iphone|ipad|ipod/.test(userAgent)
      const isSafari =
        /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent)

      setIsIosInstall(isIos && isSafari)
    })

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
  }, [])

  if (dismissed || (!installEvent && !isIosInstall)) {
    return null
  }

  async function install() {
    if (!installEvent) {
      setIsDialogOpen(true)
      return
    }

    await installEvent.prompt()
    const choice = await installEvent.userChoice

    if (choice.outcome === "accepted") {
      dismiss()
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true")
    setDismissed(true)
    setIsDialogOpen(false)
  }

  return (
    <>
      <div className={`fixed right-4 z-50 ${bottomClass}`}>
        <Button
          type="button"
          className="gap-2 rounded-full shadow-lg"
          onClick={() => void install()}
        >
          <Download className="size-4" aria-hidden="true" />
          Install
        </Button>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-5" aria-hidden="true" />
              Install Sadhana Hostel
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Share className="size-4 shrink-0" aria-hidden="true" />
              Tap Share in Safari.
            </p>
            <p>Choose Add to Home Screen.</p>
            <p>Open it from your iPhone home screen for push notifications.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismiss}>
              Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
