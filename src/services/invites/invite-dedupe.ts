import type { ResidentInviteRow } from "@/types/invites"

export function selectDuplicateActiveInviteIds(invites: ResidentInviteRow[], now = new Date()) {
  const activeByResident = new Map<string, ResidentInviteRow[]>()

  for (const invite of invites) {
    if (!isActivePendingInvite(invite, now)) {
      continue
    }

    const existing = activeByResident.get(invite.resident_id) ?? []
    existing.push(invite)
    activeByResident.set(invite.resident_id, existing)
  }

  const duplicateIds: string[] = []

  for (const activeInvites of activeByResident.values()) {
    activeInvites
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(1)
      .forEach((invite) => duplicateIds.push(invite.id))
  }

  return duplicateIds
}

function isActivePendingInvite(invite: ResidentInviteRow, now: Date) {
  return (
    invite.status === "pending" &&
    !invite.used_at &&
    !invite.revoked_at &&
    new Date(invite.expires_at).getTime() > now.getTime()
  )
}
