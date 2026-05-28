"use client"

import type { Route } from "next"
import Link from "next/link"
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
import { formatResidentIdentityMode } from "@/lib/resident-identity"
import type { ResidentInviteSafe } from "@/types/invites"

const codeSchema = z
  .object({
    inviteCode: z.string().trim().min(8, "Enter your invite code."),
  })

const activationSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
    phone: z.string().trim().min(8, "Enter your phone number.").optional().or(z.literal("")),
    identifier: z.string().trim().min(5, "Enter your email or phone.").optional().or(z.literal("")),
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
    },
  })
  const activationForm = useForm<ActivationValues>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      email: "",
      phone: "",
      identifier: "",
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
          activationForm.reset({
            email: "",
            phone: "",
            identifier: "",
            password: "",
            confirmPassword: "",
          })
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
    setManualLookup({ inviteCode: values.inviteCode })
  }

  async function onActivate(values: ActivationValues) {
    if (!validationPayload || !invite) {
      return
    }
    const identityPayload = buildActivationIdentityPayload(invite, values, Boolean(token))

    if (!identityPayload.ok) {
      activationForm.setError(identityPayload.field, { message: identityPayload.message })
      return
    }

    try {
      const result = await activateInvite.mutateAsync({
        ...validationPayload,
        ...identityPayload.value,
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
              Enter the code shared by the hostel office. We will show the right phone or email
              check before you create your password.
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
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href={"/support?topic=expired-invite" as Route}>
                  Get invite help
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={"/activate" as Route}>Enter invite code</Link>
              </Button>
            </div>
          }
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
                  {buildIdentityHint(invite, Boolean(token))}
                </p>
                <p className="mt-2 text-xs font-medium text-emerald-900">
                  {formatResidentIdentityMode(invite.identityMode)}
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
            {!token ? (
              <ActivationIdentityFields invite={invite} form={activationForm} />
            ) : null}
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

function ActivationIdentityFields({
  invite,
  form,
}: {
  invite: ResidentInviteSafe
  form: ReturnType<typeof useForm<ActivationValues>>
}) {
  if (invite.identityMode === "phone_only") {
    return (
      <Field label="Phone number" id="phone" error={form.formState.errors.phone?.message}>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="Enter the phone number used for admission"
          aria-describedby="phone-activation-hint"
          {...form.register("phone")}
        />
        <p id="phone-activation-hint" className="text-xs text-muted-foreground">
          Verification will continue using {phoneIdentityHint(invite.maskedPhone)}.
        </p>
      </Field>
    )
  }

  if (invite.identityMode === "email_only") {
    return (
      <Field label="Email" id="email" error={form.formState.errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Enter the email used for admission"
          aria-describedby="email-activation-hint"
          {...form.register("email")}
        />
        <p id="email-activation-hint" className="text-xs text-muted-foreground">
          Verification will continue using {invite.maskedEmail ?? "your admission email"}.
        </p>
      </Field>
    )
  }

  return (
    <Field
      label="Email or phone"
      id="identifier"
      error={form.formState.errors.identifier?.message}
    >
      <Input
        id="identifier"
        autoComplete="username"
        placeholder="Enter your email or phone"
        aria-describedby="hybrid-activation-hint"
        {...form.register("identifier")}
      />
      <p id="hybrid-activation-hint" className="text-xs text-muted-foreground">
        Use {invite.maskedEmail ?? "your email"} or {phoneIdentityHint(invite.maskedPhone)}.
      </p>
    </Field>
  )
}

function buildActivationIdentityPayload(
  invite: ResidentInviteSafe,
  values: ActivationValues,
  hasSignedToken: boolean
):
  | { ok: true; value: { email?: string; phone?: string } }
  | { ok: false; field: "email" | "phone" | "identifier"; message: string } {
  if (hasSignedToken) {
    return { ok: true, value: {} }
  }

  if (invite.identityMode === "phone_only") {
    return values.phone
      ? { ok: true, value: { phone: values.phone } }
      : {
          ok: false,
          field: "phone",
          message: "Enter the phone number shared with hostel administration.",
        }
  }

  if (invite.identityMode === "email_only") {
    return values.email
      ? { ok: true, value: { email: values.email } }
      : {
          ok: false,
          field: "email",
          message: "Enter the email shared with hostel administration.",
        }
  }

  const identifier = values.identifier?.trim()

  if (!identifier) {
    return {
      ok: false,
      field: "identifier",
      message: "Enter the email or phone shared with hostel administration.",
    }
  }

  return identifier.includes("@")
    ? { ok: true, value: { email: identifier } }
    : { ok: true, value: { phone: identifier } }
}

function buildIdentityHint(invite: ResidentInviteSafe, hasSignedToken: boolean) {
  if (invite.identityMode === "phone_only") {
    return `Verification will continue using ${phoneIdentityHint(invite.maskedPhone)}.`
  }

  if (invite.identityMode === "email_only") {
    return `Verification will continue using ${invite.maskedEmail ?? "your admission email"}.`
  }

  if (hasSignedToken) {
    return `This secure link supports ${invite.maskedEmail ?? "email"} or ${phoneIdentityHint(invite.maskedPhone)}.`
  }

  return `Continue with ${invite.maskedEmail ?? "your email"} or ${phoneIdentityHint(invite.maskedPhone)}.`
}

function lastVisible(value?: string | null) {
  return value?.match(/\d{4}$/)?.[0] ?? "your admission record"
}

function phoneIdentityHint(value?: string | null) {
  const lastFour = lastVisible(value)

  if (lastFour === "your admission record") {
    return "the phone from your admission record"
  }

  return `+91 ******${lastFour} (phone ending with ${lastFour})`
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
