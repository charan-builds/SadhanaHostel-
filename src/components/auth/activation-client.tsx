"use client"

import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useForm, type UseFormRegisterReturn } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { APIErrorState, EmptyState, GlobalLoader } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authSdk } from "@/sdk"
import { useActivateInvite, useValidateInvite } from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import type { ResidentInviteSafe } from "@/types/invites"

const codeSchema = z
  .object({
    inviteCode: z.string().trim().min(8, "Enter your invite code."),
    email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
    phone: z.string().trim().min(8, "Enter phone or email.").optional().or(z.literal("")),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Enter the email or phone shared with hostel administration.",
    path: ["email"],
  })

const activationSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string().min(12, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

type CodeValues = z.infer<typeof codeSchema>
type ActivationValues = z.infer<typeof activationSchema>

export function ActivationClient({ initialToken }: { initialToken?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = initialToken || searchParams.get("token") || undefined
  const validateInvite = useValidateInvite()
  const activateInvite = useActivateInvite()
  const [invite, setInvite] = useState<ResidentInviteSafe | null>(null)
  const [manualLookup, setManualLookup] = useState<CodeValues | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: {
      inviteCode: "",
      email: "",
      phone: "",
    },
  })
  const activationForm = useForm<ActivationValues>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })
  const validationPayload = useMemo(() => {
    if (token) {
      return { token }
    }

    return manualLookup ?? null
  }, [manualLookup, token])

  useEffect(() => {
    if (!validationPayload) {
      return
    }

    let cancelled = false

    validateInvite
      .mutateAsync(validationPayload)
      .then((result) => {
        if (!cancelled) {
          setInvite(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvite(null)
        }
      })

    return () => {
      cancelled = true
    }
    // validateInvite is intentionally omitted so a mutation state update does not re-run validation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationPayload])

  async function onCodeSubmit(values: CodeValues) {
    setManualLookup({
      inviteCode: values.inviteCode,
      email: values.email || undefined,
      phone: values.phone || undefined,
    })
  }

  async function onActivate(values: ActivationValues) {
    if (!validationPayload || !invite) {
      return
    }

    try {
      const result = await activateInvite.mutateAsync({
        ...validationPayload,
        password: values.password,
        confirmPassword: values.confirmPassword,
      })

      await authSdk.login({
        identifier: result.authenticatedIdentifier,
        password: values.password,
        rememberSession: true,
      })

      toast.success("Resident account activated.")
      router.replace(result.redirectTo as Route)
    } catch (error) {
      activationForm.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to activate your account.",
      })
    }
  }

  if (token && validateInvite.isPending && !invite) {
    return <GlobalLoader label="Validating invite..." />
  }

  return (
    <div className="grid gap-6">
      {!token && !invite ? (
        <form className="grid gap-4" onSubmit={codeForm.handleSubmit(onCodeSubmit)}>
          <div className="rounded-lg border bg-muted/30 p-4">
            <h2 className="text-sm font-semibold">Use an invite code</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Enter the code shared by the hostel office and confirm the email or phone used for
              your admission record.
            </p>
          </div>

          {validateInvite.error ? (
            <APIErrorState
              title="Invite could not be validated"
              message={
                validateInvite.error instanceof Error
                  ? validateInvite.error.message
                  : "Check the invite code and try again."
              }
            />
          ) : null}

          <Field label="Invite code" id="inviteCode" error={codeForm.formState.errors.inviteCode?.message}>
            <Input
              id="inviteCode"
              autoComplete="one-time-code"
              placeholder="SBH-ABCD2345"
              {...codeForm.register("inviteCode")}
            />
          </Field>
          <Field label="Email" id="email" error={codeForm.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...codeForm.register("email")} />
          </Field>
          <Field label="Phone" id="phone" error={codeForm.formState.errors.phone?.message}>
            <Input id="phone" type="tel" autoComplete="tel" {...codeForm.register("phone")} />
          </Field>
          <Button type="submit" disabled={validateInvite.isPending}>
            {validateInvite.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )}
            Validate invite
          </Button>
        </form>
      ) : null}

      {validateInvite.error && token && !invite ? (
        <EmptyState
          title="Invite unavailable"
          message="This invite link is invalid, expired, or already used. Please contact hostel administration for a new access link."
        />
      ) : null}

      {invite ? (
        <div className="grid gap-5">
          <div className="rounded-lg border bg-emerald-50 p-4 text-emerald-950">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 size-5" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Invite verified</h2>
                <p className="mt-1 text-sm leading-6">
                  {invite.residentName} · Admission {invite.admissionNumber}
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  Email {invite.maskedEmail ?? "-"} · Phone {invite.maskedPhone ?? "-"}
                </p>
              </div>
            </div>
          </div>

          {activationForm.formState.errors.root?.message ? (
            <APIErrorState
              title="Activation failed"
              message={activationForm.formState.errors.root.message}
            />
          ) : null}

          <form
            className="grid gap-4"
            onSubmit={activationForm.handleSubmit(onActivate)}
          >
            <PasswordField
              id="password"
              label="Create password"
              visible={showPassword}
              error={activationForm.formState.errors.password?.message}
              onToggle={() => setShowPassword((value) => !value)}
              registration={activationForm.register("password")}
            />
            <PasswordField
              id="confirmPassword"
              label="Confirm password"
              visible={showPassword}
              error={activationForm.formState.errors.confirmPassword?.message}
              onToggle={() => setShowPassword((value) => !value)}
              registration={activationForm.register("confirmPassword")}
            />
            <Button
              type="submit"
              disabled={activateInvite.isPending || activationForm.formState.isSubmitting}
            >
              {activateInvite.isPending || activationForm.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              Activate resident account
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  )
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function PasswordField({
  id,
  label,
  visible,
  error,
  registration,
  onToggle,
}: {
  id: string
  label: string
  visible: boolean
  error?: string
  registration: UseFormRegisterReturn
  onToggle: () => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          className="pr-11"
          aria-invalid={Boolean(error)}
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
