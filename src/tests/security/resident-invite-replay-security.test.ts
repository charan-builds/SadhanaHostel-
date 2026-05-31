import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

function projectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("resident invite replay security", () => {
  it("returns an invite_already_used conflict for completed invite replays", () => {
    const service = projectFile("src/services/invites/resident-invite.service.ts")

    expect(service).toMatch(/function\s+inviteAlreadyUsedConflict\(\):\s*never/)
    expect(service).toMatch(/reason:\s*"invite_already_used"/)
    expect(service).toMatch(
      /if\s*\(!residentUserId\)\s*{\s*return\s+this\.recoverUsedInviteWithoutResidentLink\(input\)\s*}\s*throw\s+inviteAlreadyUsedConflict\(\)/m
    )
  })

  it("does not send password updates during used-invite recovery", () => {
    const service = projectFile("src/services/invites/resident-invite.service.ts")

    expect(service).toMatch(
      /recoverUsedInviteWithoutResidentLink[\s\S]*updatePassword:\s*false/
    )
    expect(service).toMatch(/if\s*\(input\.updatePassword\s*!==\s*false\)/)
  })
})
