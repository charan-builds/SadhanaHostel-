import { describe, expect, it } from "vitest"

import {
  createHostelRuleSchema,
  hostelRuleCategories,
  hostelRulesListSchema,
} from "@/validations/hostel-rule.validation"

describe("hostel rule validation", () => {
  it("allows the required rule categories including employee accommodation", () => {
    expect(hostelRuleCategories).toEqual([
      "General",
      "Payments",
      "Discipline",
      "Visitors",
      "Leave Policy",
      "Safety",
      "Employee Accommodation",
      "Custom",
    ])
  })

  it("validates admin-created hostel rules", () => {
    const result = createHostelRuleSchema.parse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      hostelId: "22222222-2222-4222-8222-222222222222",
      category: "Employee Accommodation",
      title: "No smoking",
      description: "Smoking is not allowed in employee accommodation rooms.",
      displayOrder: "20",
      isActive: true,
    })

    expect(result.displayOrder).toBe(20)
    expect(result.category).toBe("Employee Accommodation")
  })

  it("supports active public list filters and admin include-inactive filters", () => {
    expect(
      hostelRulesListSchema.parse({
        organizationId: "11111111-1111-4111-8111-111111111111",
        activeOnly: "true",
        includeInactive: "false",
      })
    ).toMatchObject({
      activeOnly: true,
      includeInactive: false,
    })
  })
})
