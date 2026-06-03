"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import type { Route } from "next"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion } from "framer-motion"
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react"
import {
  useForm,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form"
import { toast } from "sonner"

import { APIErrorState } from "@/components/system"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth, resolveHomeRoute } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { authSdk, type SessionOverview } from "@/sdk"
import {
  changePasswordSchema,
  type ChangePasswordFormInput,
  type ChangePasswordInput,
} from "@/validations/auth.validation"

type PasswordResetGateProps = {
  area: "admin" | "resident"
  children: ReactNode
}

export function PasswordResetGate({ area, children }: PasswordResetGateProps) {
  const { session } = useAuth()
  const [completed, setCompleted] = useState(false)
  const security = session?.security

  if (!security?.forcePasswordReset || completed) {
    return children
  }

  return (
    <div className="grid min-h-[calc(100svh-12rem)] place-items-center py-8">
      <PasswordUpdateCard
        title="Create your permanent password"
        description={
          area === "resident"
            ? "Your hostel office issued temporary access. Set a private password now before continuing."
            : "Your account is using a temporary password. Replace it before using admin tools."
        }
        expiresAt={security.temporaryPasswordExpiresAt}
        submitLabel="Secure account"
        onComplete={() => setCompleted(true)}
      />
    </div>
  )
}

export function PasswordUpdateCard({
  title,
  description,
  expiresAt,
  submitLabel = "Update password",
  recoveryMode = false,
  requireCurrentPassword = false,
  onComplete,
}: {
  title: string
  description: string
  expiresAt?: string | null
  submitLabel?: string
  recoveryMode?: boolean
  requireCurrentPassword?: boolean
  onComplete?: (session: SessionOverview) => void
}) {
  const { setSession } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [completedSession, setCompletedSession] = useState<SessionOverview | null>(null)
  const form = useForm<ChangePasswordFormInput, unknown, ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  })
  const password = useWatch({ control: form.control, name: "password" }) ?? ""
  const requirements = useMemo(
    () => [
      { label: "12+ characters", met: password.length >= 12 },
      { label: "Uppercase", met: /[A-Z]/.test(password) },
      { label: "Lowercase", met: /[a-z]/.test(password) },
      { label: "Number", met: /[0-9]/.test(password) },
      { label: "Symbol", met: /[^A-Za-z0-9]/.test(password) },
    ],
    [password]
  )

  async function onSubmit(values: ChangePasswordInput) {
    try {
      const nextSession = await authSdk.changePassword(values)
      setSession(nextSession)
      setCompletedSession(nextSession)
      onComplete?.(nextSession)
      form.reset()
      toast.success("Password updated.")
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to update password. Please try again.",
      })
    }
  }

  if (completedSession) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        className="w-full max-w-xl"
      >
        <Card className="border-emerald-200/80 bg-emerald-50/80">
          <CardHeader>
            <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <CardTitle>Password updated</CardTitle>
            <CardDescription>
              Temporary access has been cleared from your account.
            </CardDescription>
          </CardHeader>
          {recoveryMode ? (
            <CardContent>
              <Button asChild>
                <Link href={resolveHomeRoute(completedSession) as Route}>Continue</Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-xl"
    >
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-white/55">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5">
          {expiresAt ? (
            <Alert variant="warning">
              <LockKeyhole className="size-4" aria-hidden="true" />
              <AlertTitle>Temporary access expires</AlertTitle>
              <AlertDescription>{formatDateTime(expiresAt)}</AlertDescription>
            </Alert>
          ) : null}

          {form.formState.errors.root?.message ? (
            <APIErrorState
              title="Password update failed"
              message={form.formState.errors.root.message}
            />
          ) : null}

          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            {requireCurrentPassword ? (
              <PasswordField
                id="currentPassword"
                label="Current password"
                visible={showPassword}
                autoComplete="current-password"
                error={form.formState.errors.currentPassword?.message}
                onToggle={() => setShowPassword((value) => !value)}
                registration={form.register("currentPassword")}
              />
            ) : null}
            <PasswordField
              id="password"
              label="New password"
              visible={showPassword}
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              onToggle={() => setShowPassword((value) => !value)}
              registration={form.register("password")}
            />
            <PasswordField
              id="confirmPassword"
              label="Confirm password"
              visible={showPassword}
              autoComplete="new-password"
              error={form.formState.errors.confirmPassword?.message}
              onToggle={() => setShowPassword((value) => !value)}
              registration={form.register("confirmPassword")}
            />

            <div className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {requirements.map((requirement) => (
                  <motion.span
                    key={requirement.label}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={
                      requirement.met
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
                        : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/60"
                    }
                  >
                    {requirement.label}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>

            <Button
              type="submit"
              className="h-10 w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-4" aria-hidden="true" />
              )}
              {submitLabel}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function PasswordField({
  id,
  label,
  visible,
  autoComplete,
  error,
  onToggle,
  registration,
}: {
  id: keyof ChangePasswordInput
  label: string
  visible: boolean
  autoComplete: string
  error?: string
  onToggle: () => void
  registration: UseFormRegisterReturn
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className="pr-11"
          {...registration}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={onToggle}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
