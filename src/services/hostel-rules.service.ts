import "server-only"

import { createHash } from "node:crypto"

import { badRequest, notFound } from "@/lib/api/api-error"
import {
  buildTenantCacheKey,
  getOrSetCache,
  invalidateCacheByTag,
} from "@/lib/cache"
import { logAuditEvent } from "@/lib/logger"
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdmissionsRepository } from "@/repositories/admissions.repository"
import { HostelRulesRepository, type HostelRuleRow } from "@/repositories/hostel-rules.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { HostelRulesOverview } from "@/types/hostel-rules"
import type { TablesUpdate } from "@/types/database"
import {
  acceptHostelRulesSchema,
  createHostelRuleSchema,
  deleteHostelRuleSchema,
  hostelRulesListSchema,
  reorderHostelRulesSchema,
  updateHostelRuleSchema,
} from "@/validations/hostel-rule.validation"

import { AuthService, assertFound } from "./auth.service"

const rulesCacheTtlMs = 60_000

export class HostelRulesService {
  private readonly authService: AuthService
  private readonly hostelRulesRepository: HostelRulesRepository
  private readonly residentsRepository: ResidentsRepository

  constructor(
    private readonly db: AppSupabaseClient,
    private readonly options: { allowMissingTableFallback?: boolean } = {}
  ) {
    this.authService = new AuthService(db)
    this.hostelRulesRepository = new HostelRulesRepository(db)
    this.residentsRepository = new ResidentsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new HostelRulesService(db)
  }

  static createPublic() {
    return new HostelRulesService(createSupabasePublicServerClient(), {
      allowMissingTableFallback: true,
    })
  }

  async listRules(input: unknown): Promise<HostelRulesOverview> {
    const values = hostelRulesListSchema.parse(input)
    const tenant = await this.resolvePublicTenant(values.organizationId, values.hostelId)
    const includeInactive = values.includeInactive === true

    if (includeInactive) {
      const context = await this.authService.requirePermission("settings.manage")

      this.authService.requireHostelAccess(
        context,
        tenant.organizationId,
        tenant.hostelId
      )

      const [rules, activeRules] = await Promise.all([
        this.hostelRulesRepository.list({
          organizationId: tenant.organizationId,
          hostelId: tenant.hostelId,
          category: values.category,
          activeOnly: false,
          search: values.search,
          page: values.page,
          pageSize: values.pageSize,
          allowMissingTableFallback: this.options.allowMissingTableFallback,
        }),
        this.listAllActiveRules(tenant.organizationId, tenant.hostelId),
      ])

      return this.buildRulesOverview(rules.data, activeRules)
    }

    return getOrSetCache(
      buildTenantCacheKey({
        organizationId: tenant.organizationId,
        hostelId: tenant.hostelId,
        scope: "hostel-rules",
        identifier: [
          values.category ?? "all",
          values.search ?? "",
          "active",
          values.page,
          values.pageSize,
        ].join(":"),
      }),
      {
        ttlMs: rulesCacheTtlMs,
        tags: [`tenant:${tenant.organizationId}:rules`],
      },
      async () => {
        const [rules, activeRules] = await Promise.all([
          this.hostelRulesRepository.list({
            organizationId: tenant.organizationId,
            hostelId: tenant.hostelId,
            category: values.category,
            activeOnly: includeInactive ? false : values.activeOnly ?? true,
            search: values.search,
            page: values.page,
            pageSize: values.pageSize,
            allowMissingTableFallback: this.options.allowMissingTableFallback,
          }),
          this.listAllActiveRules(tenant.organizationId, tenant.hostelId),
        ])

        return this.buildRulesOverview(rules.data, activeRules)
      }
    )
  }

  async getResidentRulesStatus(input: unknown): Promise<HostelRulesOverview> {
    const values = hostelRulesListSchema.parse(input)
    const context = await this.authService.getCurrentContext()
    const organizationId = values.organizationId ?? context.organizationId

    if (!organizationId) {
      throw badRequest("Organization is required to load hostel rules.")
    }

    this.authService.requireOrganizationAccess(context, organizationId)

    const resident = assertFound(
      await this.residentsRepository.getByUserId(context.authUser.id, organizationId),
      "Resident profile is not linked to this account yet."
    )
    const hostelId = resident.hostel_id
    const activeRules = await this.listAllActiveRules(organizationId, hostelId)
    const overview = this.buildRulesOverview(activeRules, activeRules)
    const [currentAcceptance, latestAcceptance] = await Promise.all([
      this.hostelRulesRepository.getAcceptance({
        organizationId,
        residentId: resident.id,
        rulesVersion: overview.rulesVersion,
      }),
      this.hostelRulesRepository.getLatestAcceptance({
        organizationId,
        residentId: resident.id,
      }),
    ])

    return {
      ...overview,
      acceptance: {
        isAccepted: Boolean(currentAcceptance),
        acceptedAt: currentAcceptance?.accepted_at ?? null,
        rulesVersion: overview.rulesVersion,
        latestAcceptedVersion: latestAcceptance?.rules_version ?? null,
        latestAcceptedAt: latestAcceptance?.accepted_at ?? null,
      },
    }
  }

  async acceptCurrentRules(input: unknown) {
    const values = acceptHostelRulesSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = assertFound(
      await this.residentsRepository.getByUserId(context.authUser.id, values.organizationId),
      "Resident profile is not linked to this account yet."
    )
    const activeRules = await this.listAllActiveRules(values.organizationId, resident.hostel_id)
    const currentVersion = computeRulesVersion(activeRules)

    if (values.rulesVersion !== currentVersion) {
      throw badRequest("Hostel rules changed. Review the latest rules before accepting.")
    }

    const acceptance = await this.hostelRulesRepository.upsertAcceptance({
      organization_id: values.organizationId,
      hostel_id: resident.hostel_id,
      resident_id: resident.id,
      rules_version: currentVersion,
      accepted_at: new Date().toISOString(),
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    logAuditEvent({
      action: "resident.hostel_rules_accepted",
      actorUserId: context.authUser.id,
      organizationId: values.organizationId,
      targetTable: "hostel_rule_acceptances",
      targetId: acceptance.id,
      outcome: "success",
      details: {
        residentId: resident.id,
        hostelId: resident.hostel_id,
        rulesVersion: currentVersion,
      },
    })

    return acceptance
  }

  async createRule(input: unknown) {
    const values = createHostelRuleSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const rule = await this.hostelRulesRepository.create({
      organization_id: values.organizationId,
      hostel_id: hostelId,
      category: values.category,
      title: values.title,
      description: values.description,
      display_order: values.displayOrder,
      is_active: values.isActive,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    await this.invalidateRules(values.organizationId)
    this.logRuleAudit("hostel_rules.created", context.authUser.id, rule)

    return rule
  }

  async updateRule(input: unknown) {
    const values = updateHostelRuleSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")
    const existingRule = await this.hostelRulesRepository.getById(
      values.ruleId,
      values.organizationId
    )

    if (!existingRule) {
      throw notFound("Hostel rule not found.")
    }

    this.authService.requireHostelAccess(
      context,
      existingRule.organization_id,
      existingRule.hostel_id
    )

    const updates: TablesUpdate<"hostel_rules"> = {
      updated_by: context.authUser.id,
    }

    if (values.hostelId !== undefined) {
      updates.hostel_id = this.authService.resolveHostelScope(
        context,
        values.organizationId,
        values.hostelId
      )
    }

    if (values.category !== undefined) updates.category = values.category
    if (values.title !== undefined) updates.title = values.title
    if (values.description !== undefined) updates.description = values.description
    if (values.displayOrder !== undefined) updates.display_order = values.displayOrder
    if (values.isActive !== undefined) updates.is_active = values.isActive

    const rule = await this.hostelRulesRepository.update(
      values.ruleId,
      values.organizationId,
      updates
    )

    await this.invalidateRules(values.organizationId)
    this.logRuleAudit("hostel_rules.updated", context.authUser.id, rule)

    return rule
  }

  async deleteRule(input: unknown) {
    const values = deleteHostelRuleSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")
    const existingRule = await this.hostelRulesRepository.getById(
      values.ruleId,
      values.organizationId
    )

    if (!existingRule) {
      throw notFound("Hostel rule not found.")
    }

    this.authService.requireHostelAccess(
      context,
      existingRule.organization_id,
      existingRule.hostel_id
    )

    const rule = await this.hostelRulesRepository.update(
      values.ruleId,
      values.organizationId,
      {
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: context.authUser.id,
        updated_by: context.authUser.id,
      }
    )

    await this.invalidateRules(values.organizationId)
    this.logRuleAudit("hostel_rules.deleted", context.authUser.id, rule)

    return rule
  }

  async reorderRules(input: unknown) {
    const values = reorderHostelRulesSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const existingRules = await this.listAllRules(values.organizationId, hostelId ?? undefined)
    const existingRuleIds = new Set(existingRules.map((rule) => rule.id))

    for (const ruleId of values.orderedRuleIds) {
      if (!existingRuleIds.has(ruleId)) {
        throw badRequest("Rule order contains a rule outside this hostel scope.")
      }
    }

    const updatedRules: HostelRuleRow[] = []

    for (const [index, ruleId] of values.orderedRuleIds.entries()) {
      updatedRules.push(
        await this.hostelRulesRepository.update(ruleId, values.organizationId, {
          display_order: (index + 1) * 10,
          updated_by: context.authUser.id,
        })
      )
    }

    await this.invalidateRules(values.organizationId)

    return updatedRules
  }

  private async listAllActiveRules(organizationId: string, hostelId?: string | null) {
    return this.listAllRules(organizationId, hostelId ?? undefined, true)
  }

  private async listAllRules(
    organizationId: string,
    hostelId?: string,
    activeOnly = false
  ) {
    const pageSize = 100
    const rules: HostelRuleRow[] = []
    let page = 1
    let total = 0

    do {
      const result = await this.hostelRulesRepository.list({
        organizationId,
        hostelId,
        activeOnly,
        page,
        pageSize,
        allowMissingTableFallback: this.options.allowMissingTableFallback,
      })

      rules.push(...result.data)
      total = result.meta.total
      page += 1
    } while (rules.length < total)

    return rules
  }

  private buildRulesOverview(
    rules: HostelRuleRow[],
    activeRulesForVersion: HostelRuleRow[]
  ): HostelRulesOverview {
    const categories = Array.from(new Set(rules.map((rule) => rule.category)))
    const lastUpdated = activeRulesForVersion.reduce<string | null>((latest, rule) => {
      if (!latest || rule.updated_at > latest) {
        return rule.updated_at
      }

      return latest
    }, null)

    return {
      rules,
      rulesVersion: computeRulesVersion(activeRulesForVersion),
      lastUpdated,
      categories,
    }
  }

  private async resolvePublicTenant(organizationId?: string, hostelId?: string) {
    const resolvedOrganizationId =
      organizationId || process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
    const resolvedHostelId = hostelId || process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID

    if (resolvedOrganizationId) {
      return {
        organizationId: resolvedOrganizationId,
        hostelId: resolvedHostelId || undefined,
      }
    }

    const defaultTenant = await new AdmissionsRepository(this.db).getDefaultTenant()

    if (!defaultTenant?.organizationId) {
      throw badRequest("Website tenant setup is required before hostel rules can be loaded.")
    }

    return {
      organizationId: defaultTenant.organizationId,
      hostelId: defaultTenant.hostelId || undefined,
    }
  }

  private async invalidateRules(organizationId: string) {
    await Promise.all([
      invalidateCacheByTag(`tenant:${organizationId}:rules`),
      invalidateCacheByTag(`tenant:${organizationId}:cms`),
    ])
  }

  private logRuleAudit(action: string, actorUserId: string, rule: HostelRuleRow) {
    logAuditEvent({
      action,
      actorUserId,
      organizationId: rule.organization_id,
      targetTable: "hostel_rules",
      targetId: rule.id,
      outcome: "success",
      details: {
        hostelId: rule.hostel_id,
        category: rule.category,
        isActive: rule.is_active,
        displayOrder: rule.display_order,
      },
    })
  }
}

export function computeRulesVersion(rules: HostelRuleRow[]) {
  if (rules.length === 0) {
    return "rules-empty"
  }

  const versionSource = rules
    .slice()
    .sort((first, second) => {
      if (first.display_order !== second.display_order) {
        return first.display_order - second.display_order
      }

      return first.id.localeCompare(second.id)
    })
    .map((rule) =>
      [
        rule.id,
        rule.category,
        rule.title,
        rule.description,
        rule.display_order,
        rule.is_active,
        rule.updated_at,
      ].join("|")
    )
    .join("\n")

  return `rules-${createHash("sha256").update(versionSource).digest("hex").slice(0, 16)}`
}
