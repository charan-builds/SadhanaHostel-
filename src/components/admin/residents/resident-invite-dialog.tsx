"use client"

import { Copy, Loader2, RotateCw, ShieldCheck, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
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
  useCreateResidentInvite,
  useResidentInvites,
  useResendResidentInvite,
  useRevokeResidentInvite,
} from "@/hooks"
import type { Tables } from "@/types/database"

type DeliveryChannel = "copy_link" | "email" | "whatsapp" | "sms_ready"

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
  const invites = useResidentInvites({
    organizationId,
    residentId: resident?.id,
  })
  const createInvite = useCreateResidentInvite()
  const resendInvite = useResendResidentInvite()
  const revokeInvite = useRevokeResidentInvite()
  const latestPending = invites.data?.find((invite) => invite.status === "pending")
  const pending = createInvite.isPending || resendInvite.isPending || revokeInvite.isPending

  async function create() {
    if (!resident) {
      return
    }

    const result = await createInvite.mutateAsync({
      organizationId,
      residentId: resident.id,
      deliveryChannel,
      expiresInHours: 72,
    })

    setActivationLink(result.activationLink)
    setWhatsappShareUrl(result.whatsappShareUrl)
    toast.success("Resident invite created.")
  }

  async function resend(inviteId: string) {
    const result = await resendInvite.mutateAsync({
      organizationId,
      inviteId,
    })

    setActivationLink(result.activationLink)
    setWhatsappShareUrl(result.whatsappShareUrl)
    toast.success("New invite link generated.")
  }

  async function revoke(inviteId: string) {
    await revokeInvite.mutateAsync({ organizationId, inviteId })
    setActivationLink(null)
    setWhatsappShareUrl(null)
    toast.success("Invite revoked.")
  }

  async function copyLink() {
    if (!activationLink) {
      return
    }

    await navigator.clipboard.writeText(activationLink)
    toast.success("Invite link copied.")
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
                </div>
              </div>
            </div>

            {resident.user_id ? (
              <EmptyState
                title="Resident account already active"
                message="This resident is already linked to a portal login."
              />
            ) : (
              <>
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
