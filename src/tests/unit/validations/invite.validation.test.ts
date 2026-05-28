import { describe, expect, it } from "vitest"

import { activateInviteSchema, validateInviteSchema } from "@/validations/invite.validation"

describe("resident invite validation schemas", () => {
  it("allows invite-code lookup before the resident knows which identity field is required", () => {
    expect(
      validateInviteSchema.parse({
        inviteCode: "sbh-abcd2345",
      })
    ).toMatchObject({
      inviteCode: "SBH-ABCD2345",
    })
  })

  it("keeps final code activation identity-verified", () => {
    expect(() =>
      activateInviteSchema.parse({
        inviteCode: "SBH-ABCD2345",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).toThrow(/Email or phone is required/)
  })

  it("allows signed-token activation without repeating phone or email", () => {
    expect(
      activateInviteSchema.parse({
        token: "v1.".padEnd(42, "a"),
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).toMatchObject({
      token: expect.any(String),
    })
  })
})
