"use client"

import Link from "next/link"
import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, LogIn } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { APIErrorState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authSdk, type SessionOverview } from "@/sdk"
import { useAuth, resolveHomeRoute } from "@/lib/auth"
import { FrontendApiError } from "@/lib/api-client"

const loginFormSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  rememberSession: z.boolean().default(true),
})

type LoginFormInput = z.input<typeof loginFormSchema>
type LoginFormValues = z.output<typeof loginFormSchema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, refreshSession, isLoading } = useAuth()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberSession: true,
    },
  })

  const nextPath = searchParams.get("next")

  useEffect(() => {
    if (!isLoading && session?.authenticated) {
      router.replace(resolveRedirect(session, nextPath) as Route)
    }
  }, [isLoading, nextPath, router, session])

  async function onSubmit(values: LoginFormValues) {
    try {
      const nextSession = await authSdk.login(values)
      await refreshSession()
      toast.success("Welcome back.")
      router.replace(resolveRedirect(nextSession, nextPath) as Route)
    } catch (error) {
      const message =
        error instanceof FrontendApiError
          ? error.message
          : "Unable to sign in. Please try again."

      setError("root", { message })
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
      {errors.root?.message ? (
        <APIErrorState title="Sign in failed" message={errors.root.message} />
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="identifier">Email or phone</Label>
        <Input
          id="identifier"
          type="text"
          autoComplete="username"
          inputMode="email"
          placeholder="admin@example.com or 9876543210"
          aria-invalid={Boolean(errors.identifier)}
          {...register("identifier")}
        />
        {errors.identifier ? (
          <p className="text-xs text-destructive">{errors.identifier.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link
            href={"/forgot-password" as Route}
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-input accent-primary"
          {...register("rememberSession")}
        />
        <span>Keep me signed in on this device.</span>
      </label>

      <Button type="submit" className="h-10 w-full" disabled={isSubmitting || isLoading}>
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogIn className="size-4" aria-hidden="true" />
        )}
        Sign in
      </Button>
    </form>
  )
}

function resolveRedirect(session: SessionOverview | null, nextPath: string | null) {
  if (nextPath?.startsWith("/") && !nextPath.startsWith("//")) {
    return nextPath
  }

  return resolveHomeRoute(session)
}
