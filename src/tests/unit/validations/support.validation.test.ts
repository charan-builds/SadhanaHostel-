import { describe, expect, it } from "vitest"

import { residentPasswordResetRequestSchema } from "@/validations/support.validation"

describe("support validation", () => {
  it("allows resident password reset requests without email or admission number", () => {
    const result = residentPasswordResetRequestSchema.parse({
      phone: "9876543210",
      email: "",
      admissionNumber: "",
      message: "",
    })

    expect(result.email).toBe("")
    expect(result.admissionNumber).toBe("")
  })
})
