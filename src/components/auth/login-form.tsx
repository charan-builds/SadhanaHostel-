"use client"

import Link from "next/link"
import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Loader2, LogIn, MessageCircle, Smartphone } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { APIErrorState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ADMIN_PORTAL_ROLES, AUTH_REDIRECTS, RESIDENT_ROLES } from "@/constants/auth"
import { authSdk, type SessionOverview } from "@/sdk"
import { useAuth, resolveHomeRoute } from "@/lib/auth"
import { FrontendApiError } from "@/lib/api-client"
import { isResidentLimitedAccessPath } from "@/lib/auth/resident-onboarding-access"

const loginFormSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  rememberSession: z.boolean().default(true),
})

const residentOtpRequestSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(8, "Enter the phone number registered by hostel administration.")
    .max(20),
})

const residentOtpVerifySchema = residentOtpRequestSchema.extend({
  token: z.string().trim().min(4, "Enter the OTP.").max(12, "OTP is too long."),
})

type LoginFormInput = z.input<typeof loginFormSchema>
type LoginFormValues = z.output<typeof loginFormSchema>
type ResidentOtpRequestValues = z.output<typeof residentOtpRequestSchema>
type ResidentOtpVerifyValues = z.output<typeof residentOtpVerifySchema>

type LoginArea = "admin" | "resident"

export function LoginForm({ expectedArea }: { expectedArea?: LoginArea }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, setSession, refreshSession, isLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identifier: searchParams.get("phone") ?? "",
      password: "",
      rememberSession: true,
    },
  })

  const nextPath = searchParams.get("next")
  const portalName = expectedArea === "admin" ? "admin" : expectedArea === "resident" ? "resident" : null

  useEffect(() => {
    if (!isLoading && session?.authenticated) {
      if (expectedArea && !isSessionAllowed(session, expectedArea)) {
        router.replace(AUTH_REDIRECTS.unauthorized as Route)
        return
      }

      router.replace(resolveRedirect(session, nextPath, expectedArea) as Route)
    }
  }, [expectedArea, isLoading, nextPath, router, session])

  async function onSubmit(values: LoginFormValues) {
    try {
      const nextSession = await authSdk.login(values)

      if (expectedArea && !isSessionAllowed(nextSession, expectedArea)) {
        await authSdk.logout()
        await refreshSession()
        setError("root", {
          message: `This account does not have ${portalName} portal access.`,
        })
        return
      }

      setSession(nextSession)
      toast.success("Welcome back.")
      router.replace(resolveRedirect(nextSession, nextPath, expectedArea) as Route)
    } catch (error) {
      const message =
        error instanceof FrontendApiError
          ? error.message
          : "Unable to sign in. Please try again."

      setError("root", { message })
    }
  }

  return (
    <div className="grid gap-5">
      <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
      {errors.root?.message ? (
        <APIErrorState
          title="Sign in failed"
          message={`${errors.root.message} If your account was suspended, locked, or invitation-only access has expired, contact hostel administration from the support center.`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={"/support?topic=account" as Route}>Open support</Link>
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="identifier">
          {expectedArea === "resident" ? "Phone or email" : "Email or phone"}
        </Label>
        <Input
          id="identifier"
          type="text"
          autoComplete="username"
          inputMode={expectedArea === "resident" ? "tel" : "email"}
          placeholder={
            expectedArea === "resident"
              ? "9876543210"
              : "admin@example.com or 9876543210"
          }
          aria-invalid={Boolean(errors.identifier)}
          {...register("identifier")}
        />
        {errors.identifier ? (
          <p className="text-xs text-destructive">{errors.identifier.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">
            {expectedArea === "resident" ? "Password or temporary password" : "Password"}
          </Label>
          {expectedArea === "resident" ? (
            <Link
              href={"/resident/reset-password" as Route}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          ) : (
            <Link
              href={"/forgot-password" as Route}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={
              expectedArea === "resident"
                ? "Enter password shared by hostel admin"
                : "Enter your password"
            }
            aria-invalid={Boolean(errors.password)}
            className="pr-11"
            {...register("password")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
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
        {expectedArea === "resident" ? "Sign in with phone/password" : "Sign in"}
      </Button>
      </form>

      {expectedArea === "resident" ? (
        <ResidentOtpAccess
          initialPhone={searchParams.get("phone") ?? ""}
          nextPath={nextPath}
          onSession={async (nextSession) => {
            setSession(nextSession)
            toast.success("OTP verified.")
            router.replace(resolveRedirect(nextSession, nextPath, expectedArea) as Route)
          }}
        />
      ) : null}
    </div>
  )
}

function ResidentOtpAccess({
  initialPhone,
  nextPath,
  onSession,
}: {
  initialPhone: string
  nextPath: string | null
  onSession: (session: SessionOverview) => Promise<void>
}) {
  const requestForm = useForm<ResidentOtpRequestValues>({
    resolver: zodResolver(residentOtpRequestSchema),
    defaultValues: { phone: initialPhone },
  })
  const verifyForm = useForm<ResidentOtpVerifyValues>({
    resolver: zodResolver(residentOtpVerifySchema),
    defaultValues: { phone: initialPhone, token: "" },
  })
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  async function requestOtp(values: ResidentOtpRequestValues) {
    try {
      setIsRequesting(true)
      const result = await authSdk.requestResidentPhoneOtp(values)
      setOtpSentTo(result.phone)
      verifyForm.setValue("phone", values.phone)
      toast.success("OTP sent to registered phone.")
    } catch (error) {
      requestForm.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to send OTP. Ask the hostel office to resend access.",
      })
    } finally {
      setIsRequesting(false)
    }
  }

  async function verifyOtp(values: ResidentOtpVerifyValues) {
    try {
      setIsVerifying(true)
      const session = await authSdk.verifyResidentPhoneOtp({
        ...values,
        rememberSession: true,
      })
      await onSession(session)
    } catch (error) {
      verifyForm.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "OTP verification failed. Request a fresh code and try again.",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-5 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold">Phone OTP access</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Use OTP after your hostel office has generated resident access. New draft residents can
            also use the temporary password shared on WhatsApp.
          </p>
        </div>
      </div>

      {requestForm.formState.errors.root?.message ? (
        <div className="mt-4">
          <APIErrorState
            title="OTP could not be sent"
            message={requestForm.formState.errors.root.message}
          />
        </div>
      ) : null}

      <form className="mt-4 grid gap-3" onSubmit={requestForm.handleSubmit(requestOtp)}>
        <div className="grid gap-2">
          <Label htmlFor="otp-phone">Registered phone</Label>
          <Input
            id="otp-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="9876543210"
            aria-invalid={Boolean(requestForm.formState.errors.phone)}
            {...requestForm.register("phone")}
          />
          {requestForm.formState.errors.phone ? (
            <p className="text-xs text-destructive">
              {requestForm.formState.errors.phone.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="outline" disabled={isRequesting}>
          {isRequesting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="size-4" aria-hidden="true" />
          )}
          Send OTP
        </Button>
      </form>

      {otpSentTo ? (
        <form className="mt-4 grid gap-3" onSubmit={verifyForm.handleSubmit(verifyOtp)}>
          <p className="text-xs text-muted-foreground">
            OTP sent to {otpSentTo}. It expires shortly.
            {nextPath ? " You will continue to your requested resident page after login." : ""}
          </p>
          {verifyForm.formState.errors.root?.message ? (
            <APIErrorState
              title="OTP verification failed"
              message={verifyForm.formState.errors.root.message}
            />
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="otp-token">OTP</Label>
            <Input
              id="otp-token"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-invalid={Boolean(verifyForm.formState.errors.token)}
              {...verifyForm.register("token")}
            />
            {verifyForm.formState.errors.token ? (
              <p className="text-xs text-destructive">
                {verifyForm.formState.errors.token.message}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={isVerifying}>
            {isVerifying ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="size-4" aria-hidden="true" />
            )}
            Verify OTP
          </Button>
        </form>
      ) : null}
    </div>
  )
}

function resolveRedirect(
  session: SessionOverview | null,
  nextPath: string | null,
  expectedArea?: LoginArea
) {
  if (expectedArea === "admin") {
    return nextPath?.startsWith("/admin/") || nextPath === "/admin"
      ? nextPath
      : AUTH_REDIRECTS.adminHome
  }

  if (expectedArea === "resident") {
    const residentNext =
      nextPath?.startsWith("/resident/") || nextPath === "/resident"
        ? nextPath
        : null

    if (
      session?.onboardingRequired &&
      residentNext &&
      isResidentLimitedAccessPath(residentNext)
    ) {
      return residentNext
    }

    if (session?.onboardingRequired && session.redirectTo?.startsWith("/resident")) {
      return session.redirectTo
    }

    return residentNext
      ? residentNext
      : AUTH_REDIRECTS.residentHome
  }

  if (nextPath?.startsWith("/") && !nextPath.startsWith("//")) {
    return nextPath
  }

  return resolveHomeRoute(session)
}

function isSessionAllowed(session: SessionOverview, area: LoginArea) {
  const allowedRoles = area === "admin" ? ADMIN_PORTAL_ROLES : RESIDENT_ROLES

  return session.roles.some((role) => (allowedRoles as readonly string[]).includes(role))
}
