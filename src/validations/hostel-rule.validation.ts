import { z } from "zod"

import {
  booleanLikeSchema,
  paginationSchema,
  uuidSchema,
} from "./common.validation"

export const hostelRuleCategories = [
  "General",
  "Payments",
  "Discipline",
  "Visitors",
  "Leave Policy",
  "Safety",
  "Employee Accommodation",
  "Custom",
] as const

export const hostelRuleCategorySchema = z.enum(hostelRuleCategories)

export const hostelRulesListSchema = paginationSchema.extend({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
  category: hostelRuleCategorySchema.optional(),
  activeOnly: booleanLikeSchema.optional(),
  includeInactive: booleanLikeSchema.optional(),
  search: z.string().trim().max(120).optional(),
})

export const createHostelRuleSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  category: hostelRuleCategorySchema.default("General"),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(5).max(2000),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const updateHostelRuleSchema = z.object({
  ruleId: uuidSchema,
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  category: hostelRuleCategorySchema.optional(),
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const deleteHostelRuleSchema = z.object({
  ruleId: uuidSchema,
  organizationId: uuidSchema,
})

export const reorderHostelRulesSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  orderedRuleIds: z.array(uuidSchema).min(1).max(500),
})

export const acceptHostelRulesSchema = z.object({
  organizationId: uuidSchema,
  rulesVersion: z.string().trim().min(8).max(120),
})

export type HostelRuleCategory = (typeof hostelRuleCategories)[number]
export type HostelRulesListInput = z.infer<typeof hostelRulesListSchema>
export type CreateHostelRuleInput = z.infer<typeof createHostelRuleSchema>
export type UpdateHostelRuleInput = z.infer<typeof updateHostelRuleSchema>
export type DeleteHostelRuleInput = z.infer<typeof deleteHostelRuleSchema>
export type ReorderHostelRulesInput = z.infer<typeof reorderHostelRulesSchema>
export type AcceptHostelRulesInput = z.infer<typeof acceptHostelRulesSchema>
