import { describe, expect, it } from "vitest"

import { computeRulesVersion } from "@/services/hostel-rules.service"
import type { HostelRule } from "@/types/hostel-rules"

const baseRule = {
  id: "rule-1",
  organization_id: "org-1",
  hostel_id: "hostel-1",
  category: "General",
  title: "No alcohol",
  description: "Alcohol is not allowed inside the hostel.",
  display_order: 10,
  is_active: true,
  created_at: "2026-06-08T00:00:00.000Z",
  updated_at: "2026-06-08T00:00:00.000Z",
  created_by: null,
  updated_by: null,
  deleted_at: null,
  deleted_by: null,
} satisfies HostelRule

describe("hostel rules service versioning", () => {
  it("computes a stable rules version independent of input order", () => {
    const secondRule = {
      ...baseRule,
      id: "rule-2",
      title: "No smoking",
      display_order: 20,
    } satisfies HostelRule

    expect(computeRulesVersion([secondRule, baseRule])).toBe(
      computeRulesVersion([baseRule, secondRule])
    )
  })

  it("changes the rules version when rule content changes", () => {
    const originalVersion = computeRulesVersion([baseRule])
    const changedVersion = computeRulesVersion([
      {
        ...baseRule,
        description: "Alcohol is not allowed inside rooms or common areas.",
        updated_at: "2026-06-08T01:00:00.000Z",
      },
    ])

    expect(changedVersion).not.toBe(originalVersion)
    expect(changedVersion).toMatch(/^rules-[a-f0-9]{16}$/)
  })

  it("keeps an explicit empty-rules version", () => {
    expect(computeRulesVersion([])).toBe("rules-empty")
  })
})
