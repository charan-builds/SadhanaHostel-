"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { Loader2, MailWarning } from "lucide-react"

import { PasswordUpdateCard } from "@/components/auth/password-reset-gate"
import { APIErrorState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth"

type RecoveryState =
  | { status: "checking" }
  | { status: "ready" }
  | { status: "missing" }
  | { status: "error"; message: string }

export function ResetPasswordClient() {
  const { refreshSession } = useAuth()
  const [state, setState] = useState<RecoveryState>({ status: "checking" })

  useEffect(() => {
    let cancelled = false

    async function prepareRecoverySession() {
      try {
        const supabase = createSupabaseBrowserClient()
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            throw error
          }

          url.searchParams.delete("code")
          window.history.replaceState(null, "", `${url.pathname}${url.search}`)
        }

        if (window.location.hash.includes("access_token")) {
          await supabase.auth.getSession()
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`
          )
        }

        const session = await refreshSession()

        if (cancelled) {
          return
        }

        setState(session.authenticated ? { status: "ready" } : { status: "missing" })
      } catch (error) {
        if (cancelled) {
          return
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The reset link could not be verified.",
        })
      }
    }

    void prepareRecoverySession()

    return () => {
      cancelled = true
    }
  }, [refreshSession])

  if (state.status === "checking") {
    return (
      <div className="rounded-xl border bg-muted/30 p-5">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Verifying secure reset link...
        </div>
      </div>
    )
  }

  if (state.status === "missing") {
    return (
      <div className="rounded-xl border bg-muted/30 p-5">
        <MailWarning className="size-6 text-amber-600" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold">Reset link required</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Open the latest password reset email on this device. If it expired, request a new one.
        </p>
        <Button asChild className="mt-5" variant="outline">
          <Link href={"/forgot-password" as Route}>Request new link</Link>
        </Button>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <APIErrorState
        title="Reset link failed"
        message={state.message}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={"/forgot-password" as Route}>Request new link</Link>
          </Button>
        }
      />
    )
  }

  return (
    <PasswordUpdateCard
      title="Set a new password"
      description="Your reset link is verified. Choose a strong password to finish recovery."
      submitLabel="Update password"
      recoveryMode
    />
  )
}
