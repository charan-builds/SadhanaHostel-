"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import type { Route } from "next"
import { KeyRound, Loader2, Send } from "lucide-react"
import { useForm } from "react-hook-form"

import { APIErrorState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCreateResidentPasswordResetRequest } from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import {
  residentPasswordResetRequestSchema,
  type ResidentPasswordResetRequestInput,
} from "@/validations/support.validation"

export function ResidentPasswordResetRequestForm() {
  const requestReset = useCreateResidentPasswordResetRequest()
  const form = useForm<ResidentPasswordResetRequestInput>({
    resolver: zodResolver(residentPasswordResetRequestSchema),
    defaultValues: {
      phone: "",
      message: "",
    },
  })

  async function onSubmit(values: ResidentPasswordResetRequestInput) {
    try {
      await requestReset.mutateAsync(values)
      form.reset()
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to send password reset request.",
      })
    }
  }

  if (requestReset.isSuccess && !form.formState.errors.root) {
    return (
      <div className="rounded-xl border bg-emerald-50 p-5 text-emerald-950">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Request sent</h2>
            <p className="mt-2 text-sm leading-6">
              If this phone matches an active resident account, hostel administration will verify
              your identity and issue a 24-hour temporary password. The request appears in Admin
              sidebar under Password resets.
            </p>
          </div>
        </div>
        <Button asChild className="mt-5" variant="outline">
          <Link href={"/resident/login" as Route}>Back to resident login</Link>
        </Button>
      </div>
    )
  }

  return (
    <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
      {form.formState.errors.root?.message ? (
        <APIErrorState
          title="Request failed"
          message={form.formState.errors.root.message}
        />
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="reset-phone">Registered phone</Label>
        <Input
          id="reset-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9876543210"
          aria-invalid={Boolean(form.formState.errors.phone)}
          {...form.register("phone")}
        />
        {form.formState.errors.phone ? (
          <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="reset-message">Message</Label>
        <Textarea
          id="reset-message"
          className="min-h-24"
          placeholder="Optional note for hostel admin."
          aria-invalid={Boolean(form.formState.errors.message)}
          {...form.register("message")}
        />
        {form.formState.errors.message ? (
          <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>
        ) : null}
      </div>

      <Button type="submit" className="h-10 w-full" disabled={requestReset.isPending}>
        {requestReset.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        Send request to admin
      </Button>
    </form>
  )
}
