import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("attendance and gate pass workflow", () => {
  it("lets residents submit gate pass requests through the tracked support flow", () => {
    const validation = readFileSync(join(root, "src/validations/support.validation.ts"), "utf8")
    const resident = readFileSync(
      join(root, "src/components/resident/resident-support-client.tsx"),
      "utf8"
    )

    expect(validation).toContain('"gate_pass"')
    expect(resident).toContain("Gate pass")
    expect(resident).toContain("gate_pass_request")
    expect(resident).toContain("Gate pass approval request")
    expect(resident).toContain("temporary check-out")
  })

  it("surfaces gate pass approval and return logging in admin operations", () => {
    const admin = readFileSync(
      join(root, "src/components/admin/support/admin-operational-alerts-client.tsx"),
      "utf8"
    )
    const service = readFileSync(join(root, "src/services/support.service.ts"), "utf8")

    expect(admin).toContain('searchParams.get("queue") === "gate-pass"')
    expect(admin).toContain("Gate pass approval queue")
    expect(admin).toContain("Gate pass workflow")
    expect(admin).toContain("Record check-out time")
    expect(admin).toContain("Approve gate pass")
    expect(admin).toContain("Mark returned")
    expect(admin).toContain("Mark returned after check-in")
    expect(admin).toContain("isGatePassRequest")
    expect(service).toContain("support.gate_pass_requests")
    expect(service).toContain("workflow: \"gate_pass_request\"")
    expect(service).toContain("Gate pass tracking")
  })
})
