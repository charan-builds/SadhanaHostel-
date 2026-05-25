import { describe, expect, it } from "vitest"

import { selectDuplicateActiveInviteIds } from "@/services/invites/invite-dedupe"
import type { ResidentInviteRow } from "@/types/invites"

const baseInvite = {
  organization_id: "org-1",
  hostel_id: "hostel-1",
  resident_id: "resident-1",
  email: null,
  phone: "+919000000000",
  invite_code: "ABC123",
  invite_token_hash: "hash",
  expires_at: "2026-06-01T00:00:00.000Z",
  used_at: null,
  revoked_at: null,
  invited_by: "admin-1",
  status: "pending",
  metadata: {},
  updated_at: "2026-05-20T00:00:00.000Z",
  created_by: "admin-1",
  updated_by: "admin-1",
} satisfies Omit<ResidentInviteRow, "id" | "created_at">

describe("resident invite deduplication", () => {
  it("keeps the newest active invite per resident and expires older active duplicates", () => {
    const duplicateIds = selectDuplicateActiveInviteIds(
      [
        {
          ...baseInvite,
          id: "older",
          created_at: "2026-05-20T00:00:00.000Z",
        },
        {
          ...baseInvite,
          id: "newer",
          created_at: "2026-05-21T00:00:00.000Z",
        },
        {
          ...baseInvite,
          id: "other-resident",
          resident_id: "resident-2",
          created_at: "2026-05-21T00:00:00.000Z",
        },
      ],
      new Date("2026-05-22T00:00:00.000Z")
    )

    expect(duplicateIds).toEqual(["older"])
  })

  it("ignores used, revoked, and expired invites", () => {
    const duplicateIds = selectDuplicateActiveInviteIds(
      [
        {
          ...baseInvite,
          id: "used",
          used_at: "2026-05-21T00:00:00.000Z",
          created_at: "2026-05-20T00:00:00.000Z",
        },
        {
          ...baseInvite,
          id: "revoked",
          revoked_at: "2026-05-21T00:00:00.000Z",
          created_at: "2026-05-20T00:00:00.000Z",
        },
        {
          ...baseInvite,
          id: "expired",
          expires_at: "2026-05-01T00:00:00.000Z",
          created_at: "2026-05-20T00:00:00.000Z",
        },
      ],
      new Date("2026-05-22T00:00:00.000Z")
    )

    expect(duplicateIds).toEqual([])
  })
})
