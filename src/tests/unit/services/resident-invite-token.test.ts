import { describe, expect, it } from "vitest"

import {
  generateInviteCode,
  generateSignedInviteToken,
  hashInviteToken,
  verifySignedInviteToken,
} from "@/services/invites"

describe("resident invite token utilities", () => {
  it("generates signed one-time tokens that can be hashed for storage", () => {
    const token = generateSignedInviteToken()
    const hash = hashInviteToken(token)

    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(verifySignedInviteToken(token)).toBe(true)
  })

  it("rejects tampered invite tokens", () => {
    const token = generateSignedInviteToken()
    const tampered = token.replace(/.$/, "x")

    expect(verifySignedInviteToken(tampered)).toBe(false)
  })

  it("generates hostel-branded manual invite codes", () => {
    expect(generateInviteCode()).toMatch(/^SBH-[A-Z0-9]{8}$/)
  })
})
