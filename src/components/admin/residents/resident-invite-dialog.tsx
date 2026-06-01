"use client"

import { Copy, Loader2, RotateCw, ShieldCheck, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDateTime } from "@/lib/format"
import {
  formatResidentIdentityMode,
  getResidentIdentityMode,
} from "@/lib/resident-identity"
import {
  useCreateResidentInvite,
  useResidentInvites,
  useResendResidentInvite,
  useResetResidentPassword,
  useRevokeResidentInvite,
} from "@/hooks"
import type { ResidentPasswordResetResult } from "@/types/residents"
import type { Tables } from "@/types/database"

type DeliveryChannel = "copy_link" | "email" | "whatsapp" | "sms_ready" | "temp_password"

export function ResidentInviteDialog({
  resident,
  organizationId,
  open,
  onOpenChange,
}: {
  resident: Tables<"residents"> | null
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>("copy_link")
  const [activationLink, setActivationLink] = useState<string | null>(null)
  const [whatsappShareUrl, setWhatsappShareUrl] = useState<string | null>(null)
  const [temporaryAccess, setTemporaryAccess] = useState<ResidentPasswordResetResult | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)
  const invites = useResidentInvites({
    organizationId,
    residentId: resident?.id,
  })
  const createInvite = useCreateResidentInvite()
  const resendInvite = useResendResidentInvite()
  const revokeInvite = useRevokeResidentInvite()
  const resetPassword = useResetResidentPassword()
  const latestPending = invites.data?.find((invite) => invite.status === "pending")
  const pending =
    createInvite.isPending ||
    resendInvite.isPending ||
    revokeInvite.isPending ||
    resetPassword.isPending

  async function create() {
    if (!resident) {
      return
    }

    try {
      setActionError(null)
      const result = await createInvite.mutateAsync({
        organizationId,
        residentId: resident.id,
        deliveryChannel,
        expiresInHours: 72,
      })

      setActivationLink(result.activationLink)
      setWhatsappShareUrl(result.whatsappShareUrl)
      setTemporaryAccess(
        result.delivery.temporaryPassword
          ? {
              residentId: result.invite.resident_id,
              targetUserId: resident.user_id ?? "",
              temporaryPassword: result.delivery.temporaryPassword,
              expiresAt: result.invite.expires_at,
              loginLink: result.loginLink,
            }
          : null
      )
      toast.success("Resident invite created.")
    } catch (error) {
      setActionError(error)
    }
  }

  async function resend(inviteId: string) {
    try {
      setActionError(null)
      const result = await resendInvite.mutateAsync({
        organizationId,
        inviteId,
      })

      setActivationLink(result.activationLink)
      setWhatsappShareUrl(result.whatsappShareUrl)
      setTemporaryAccess(null)
      toast.success("New invite link generated.")
    } catch (error) {
      setActionError(error)
    }
  }

  async function revoke(inviteId: string) {
    try {
      setActionError(null)
      await revokeInvite.mutateAsync({ organizationId, inviteId })
      setActivationLink(null)
      setWhatsappShareUrl(null)
      setTemporaryAccess(null)
      toast.success("Invite revoked.")
    } catch (error) {
      setActionError(error)
    }
  }

  async function resetResidentPassword() {
    if (!resident) {
      return
    }

    try {
      setActionError(null)
      const result = await resetPassword.mutateAsync({
        organizationId,
        residentId: resident.id,
      })

      setTemporaryAccess(result)
      setActivationLink(null)
      setWhatsappShareUrl(null)
      toast.success("Temporary password generated.")
    } catch (error) {
      setActionError(error)
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryAccess?.temporaryPassword) {
      return
    }

    try {
      await navigator.clipboard.writeText(temporaryAccess.temporaryPassword)
      toast.success("Temporary password copied.")
    } catch {
      toast.error("Copy failed. Select and copy the password manually.")
    }
  }

  async function copyLink() {
    if (!activationLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(activationLink)
      toast.success("Invite link copied.")
    } catch {
      toast.error("Copy failed. Select and copy the invite link manually.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resident portal invite</DialogTitle>
          <DialogDescription>
            Generate one-time account activation access after the resident is approved by hostel
            administration.
          </DialogDescription>
        </DialogHeader>

        {!resident ? null : (
          <div className="grid gap-5">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 size-5 text-emerald-600" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">{resident.full_name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Admission {resident.admission_number} · {resident.email ?? resident.phone ?? "No contact"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {formatResidentIdentityMode(getResidentIdentityMode(resident))}
                    </Badge>
                    <Badge variant={resident.user_id ? "secondary" : "outline"}>
                      {resident.user_id ? "Auth linked" : "Activation pending"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {resident.user_id ? (
              <div className="grid gap-4">
                {actionError ? (
                  <APIErrorState
                    title="Password reset failed"
                    error={actionError}
                    onRetry={() => setActionError(null)}
                  />
                ) : null}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="font-semibold">Resident account already active</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Generate a 24-hour temporary password only after verifying the resident identity.
                    The resident must sign in through the resident portal and set a new password.
                  </p>
                  <Button className="mt-4" onClick={() => void resetResidentPassword()} disabled={pending}>
                    {resetPassword.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Reset temporary password
                  </Button>
                </div>
                {temporaryAccess ? (
                  <TemporaryAccessPanel
                    access={temporaryAccess}
                    onCopyPassword={copyTemporaryPassword}
                  />
                ) : null}
              </div>
            ) : (
              <>
                {actionError ? (
                  <APIErrorState
                    title="Invite action failed"
                    error={actionError}
                    onRetry={() => setActionError(null)}
                  />
                ) : null}
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Delivery mode</label>
                    <Select
                      value={deliveryChannel}
                      onValueChange={(value) => setDeliveryChannel(value as DeliveryChannel)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="copy_link">Copy link manually</SelectItem>
                        <SelectItem value="email">Queue email</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp share</SelectItem>
                        <SelectItem value="sms_ready">SMS-ready</SelectItem>
                        <SelectItem value="temp_password">Phone + temporary password</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => void create()} disabled={pending}>
                    {createInvite.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Generate invite
                  </Button>
                </div>

                {activationLink ? (
                  <div className="rounded-lg border bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-950">
                      New one-time activation link
                    </p>
                    <p className="mt-2 break-all text-xs text-emerald-900">{activationLink}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void copyLink()}>
                        <Copy className="size-3.5" aria-hidden="true" />
                        Copy link
                      </Button>
                      {whatsappShareUrl ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={whatsappShareUrl} target="_blank" rel="noreferrer">
                            WhatsApp share
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {temporaryAccess ? (
                  <TemporaryAccessPanel
                    access={temporaryAccess}
                    onCopyPassword={copyTemporaryPassword}
                  />
                ) : null}

                {invites.isLoading ? (
                  <div className="h-20 rounded-lg border bg-muted/50" />
                ) : invites.isError ? (
                  <APIErrorState
                    title="Invite history failed to load"
                    error={invites.error}
                    onRetry={() => void invites.refetch()}
                  />
                ) : (
                  <div className="grid gap-3">
                    <h3 className="text-sm font-semibold">Invite history</h3>
                    {(invites.data ?? []).length === 0 ? (
                      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                        No invites have been generated for this resident yet.
                      </p>
                    ) : (
                      invites.data?.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={invite.status} />
                              <span className="text-sm font-medium">{invite.invite_code}</span>
                              <Badge variant="outline">
                                {formatResidentIdentityMode(getResidentIdentityMode(invite))}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Expires {formatDateTime(invite.expires_at)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending || invite.status !== "pending"}
                              onClick={() => void resend(invite.id)}
                            >
                              <RotateCw className="size-3.5" aria-hidden="true" />
                              Resend
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={pending || invite.status !== "pending"}
                              onClick={() => void revoke(invite.id)}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                              Revoke
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {latestPending && !activationLink ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    A pending invite already exists. Because raw tokens are never stored, use
                    Resend to generate a fresh one-time link.
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TemporaryAccessPanel({
  access,
  onCopyPassword,
}: {
  access: ResidentPasswordResetResult
  onCopyPassword: () => Promise<void>
}) {
  return (
    <div className="rounded-lg border bg-blue-50 p-4">
      <p className="text-sm font-semibold text-blue-950">Temporary resident password</p>
      <p className="mt-2 text-xs leading-5 text-blue-900">
        Share this only after confirming the resident identity. It expires{" "}
        {formatDateTime(access.expiresAt)}.
      </p>
      <div className="mt-3 grid gap-2 rounded-md bg-white/70 p-3 text-sm">
        <p>
          Login: <span className="break-all font-medium">{access.loginLink}</span>
        </p>
        <p>
          Password:{" "}
          <span className="break-all font-mono font-semibold">
            {access.temporaryPassword}
          </span>
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void onCopyPassword()}>
          <Copy className="size-3.5" aria-hidden="true" />
          Copy password
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={access.loginLink} target="_blank" rel="noreferrer">
            Open login
          </a>
        </Button>
      </div>
    </div>
  )
}
