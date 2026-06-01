"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Mail } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { APIErrorState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FrontendApiError } from "@/lib/api-client"
import { authSdk } from "@/sdk"

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitSuccessful, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    try {
      await authSdk.resetPassword({
        email: values.email,
        redirectTo: `${window.location.origin}/reset-password`,
      })
    } catch (error) {
      setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to send reset instructions.",
      })
    }
  }

  if (isSubmitSuccessful && !errors.root) {
    return (
      <div className="rounded-lg border bg-muted/30 p-5">
        <h2 className="text-base font-semibold">Check your email</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          If the address matches an account, password reset instructions have been sent.
        </p>
        <Button asChild className="mt-5" variant="outline">
          <Link href={"/admin/login" as Route}>Back to admin login</Link>
        </Button>
      </div>
    )
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
      {errors.root?.message ? (
        <APIErrorState title="Reset failed" message={errors.root.message} />
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="email">Account email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="resident@example.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Mail className="size-4" aria-hidden="true" />
        )}
        Send reset instructions
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Resident account?{" "}
        <Link
          href={"/resident/reset-password" as Route}
          className="font-medium text-primary hover:underline"
        >
          Request admin reset
        </Link>
      </p>
    </form>
  )
}
