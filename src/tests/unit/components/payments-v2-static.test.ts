import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("payment experience v2 form safeguards", () => {
  it("keeps resident payment fields linked to guidance and announced validation", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-payments-client.tsx"),
      "utf8"
    )

    expect(source).toContain('mode: "onBlur"')
    expect(source).toContain("shouldFocusError: true")
    expect(source).toContain('aria-describedby={errors.amount ? "amount-hint amount-error" : "amount-hint"}')
    expect(source).toContain('"transactionId-hint transactionId-error"')
    expect(source).toContain('aria-describedby="proof-hint"')
    expect(source).toContain("PaymentFieldError")
    expect(source).toContain('role="alert"')
  })
})
