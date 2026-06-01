"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Loader2, LogOut } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authSdk } from "@/sdk"
import { useAuth } from "@/lib/auth"

export function DashboardUserActions() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function logout() {
    setIsLoggingOut(true)

    try {
      await authSdk.logout()
      await refreshSession()
      router.replace("/resident/login" as Route)
    } catch {
      toast.error("Logout failed. Please try again.")
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="justify-start gap-2"
      disabled={isLoggingOut}
      onClick={() => void logout()}
    >
      {isLoggingOut ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      Logout
    </Button>
  )
}
