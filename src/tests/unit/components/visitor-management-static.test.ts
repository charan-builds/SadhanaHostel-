import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("visitor management workflow", () => {
  it("lets residents register visitor approval requests through support", () => {
    const validation = readFileSync(join(root, "src/validations/support.validation.ts"), "utf8")
    const resident = readFileSync(
      join(root, "src/components/resident/resident-support-client.tsx"),
      "utf8"
    )

    expect(validation).toContain('"visitor"')
    expect(resident).toContain("Visitor pass")
    expect(resident).toContain("visitor_request")
    expect(resident).toContain("workflowForCategory")
    expect(resident).toContain("Visitor approval request")
  })

  it("surfaces visitor approvals in the admin operational queue", () => {
    const admin = readFileSync(
      join(root, "src/components/admin/support/admin-operational-alerts-client.tsx"),
      "utf8"
    )
    const service = readFileSync(join(root, "src/services/support.service.ts"), "utf8")

    expect(admin).toContain('searchParams.get("queue") === "visitors"')
    expect(admin).toContain("Visitor approval queue")
    expect(admin).toContain("Approve visitor")
    expect(admin).toContain("isVisitorRequest")
    expect(service).toContain("support.visitor_requests")
    expect(service).toContain("workflow: \"visitor_request\"")
    expect(service).toContain("Visitor approval tracking")
  })
})
