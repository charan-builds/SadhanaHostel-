import "server-only"

import { badRequest } from "@/lib/api/api-error"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestId } from "@/lib/tracing"
import {
  OrganizationsRepository,
  type HostelRow,
  type OrganizationRow,
} from "@/repositories/organizations.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"
import {
  bootstrapAdminTenantSchema,
  hostelCreateSchema,
  hostelUpdateSchema,
  updateOrganizationSchema,
} from "@/validations/platform.validation"

import { assertFound, AuthService } from "./auth.service"

export type SetupStatus = {
  setupRequired: boolean
  missing: Array<"organization" | "hostel" | "hostel_scope">
  organization: OrganizationRow | null
  hostels: HostelRow[]
  activeHostel: HostelRow | null
}

export class PlatformService {
  private readonly authService: AuthService
  private readonly organizationsRepository: OrganizationsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.organizationsRepository = new OrganizationsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new PlatformService(db)
  }

  async getSetupStatus(): Promise<SetupStatus> {
    const context = await this.authService.requirePermission("settings.manage")

    if (!context.organizationId) {
      return {
        setupRequired: true,
        missing: ["organization", "hostel", "hostel_scope"],
        organization: null,
        hostels: [],
        activeHostel: null,
      }
    }

    const organization = await this.organizationsRepository.getOrganizationById(
      context.organizationId
    )
    const hostels = await this.organizationsRepository.listHostels(context.organizationId)
    const activeHostels = hostels.filter((hostel) => hostel.is_active)
    const activeHostel =
      activeHostels.find((hostel) => context.hostelIds.includes(hostel.id)) ??
      activeHostels[0] ??
      null
    const missing: SetupStatus["missing"] = []

    if (!organization) {
      missing.push("organization")
    }

    if (activeHostels.length === 0) {
      missing.push("hostel")
    }

    if (!activeHostel) {
      missing.push("hostel_scope")
    }

    return {
      setupRequired: missing.length > 0,
      missing,
      organization,
      hostels,
      activeHostel,
    }
  }

  async bootstrapTenant(input: unknown) {
    const values = bootstrapAdminTenantSchema.parse(input)
    await this.authService.requirePermission("settings.manage")

    return this.organizationsRepository.bootstrapAdminTenant(values)
  }

  async getOrganization() {
    const context = await this.authService.requirePermission("settings.manage")

    if (!context.organizationId) {
      throw badRequest("Organization setup is required before settings can be loaded.")
    }

    return assertFound(
      await this.organizationsRepository.getOrganizationById(context.organizationId),
      "Organization not found."
    )
  }

  async updateOrganization(input: unknown) {
    const values = updateOrganizationSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const current = assertFound(
      await this.organizationsRepository.getOrganizationById(values.organizationId),
      "Organization not found."
    )
    const settings = values.settings
      ? ({
          ...jsonObjectOrEmpty(current.settings),
          ...values.settings,
        } satisfies Record<string, unknown>)
      : undefined

    const organization = await this.organizationsRepository.updateOrganization(values.organizationId, {
      name: values.name,
      legal_name: values.legalName,
      billing_email: values.billingEmail,
      contact_phone: values.contactPhone,
      address_line1: values.addressLine1,
      address_line2: values.addressLine2,
      city: values.city,
      state: values.state,
      postal_code: values.postalCode,
      country: values.country,
      settings: settings as Json | undefined,
      updated_by: context.authUser.id,
    })

    await this.audit({
      action: "platform.organization.updated",
      organizationId: organization.id,
      hostelId: null,
      tableName: "organizations",
      recordId: organization.id,
      actorUserId: context.authUser.id,
      oldValues: current,
      newValues: organization,
    })

    return organization
  }

  async listHostels() {
    const context = await this.authService.requirePermission("settings.manage")

    if (!context.organizationId) {
      throw badRequest("Organization setup is required before hostels can be loaded.")
    }

    this.authService.requireOrganizationAccess(context, context.organizationId)

    return this.organizationsRepository.listHostels(context.organizationId)
  }

  async createHostel(input: unknown) {
    const values = hostelCreateSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const hostel = await this.organizationsRepository.createHostel({
      organization_id: values.organizationId,
      name: values.name,
      code: values.code.toUpperCase(),
      slug: values.slug,
      phone: values.phone,
      email: values.email,
      address_line1: values.addressLine1,
      address_line2: values.addressLine2,
      city: values.city,
      state: values.state,
      postal_code: values.postalCode,
      capacity: values.capacity,
      settings: values.settings as Json,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    await this.organizationsRepository.createHostelCapacity({
      organization_id: values.organizationId,
      hostel_id: hostel.id,
      total_beds: values.capacity,
      notes: "Capacity created from admin hostel management.",
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    await this.audit({
      action: "platform.hostel.created",
      organizationId: values.organizationId,
      hostelId: hostel.id,
      tableName: "hostels",
      recordId: hostel.id,
      actorUserId: context.authUser.id,
      oldValues: null,
      newValues: hostel,
    })

    return hostel
  }

  async updateHostel(input: unknown) {
    const values = hostelUpdateSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")

    this.authService.requireOrganizationAccess(context, values.organizationId)
    const current = assertFound(
      await this.organizationsRepository.getHostelById(values.organizationId, values.hostelId),
      "Hostel not found."
    )

    const hostel = await this.organizationsRepository.updateHostel(
      values.organizationId,
      values.hostelId,
      {
        name: values.name,
        code: values.code?.toUpperCase(),
        slug: values.slug,
        phone: values.phone,
        email: values.email,
        address_line1: values.addressLine1,
        address_line2: values.addressLine2,
        city: values.city,
        state: values.state,
        postal_code: values.postalCode,
        capacity: values.capacity,
        is_active: values.isActive,
        settings: values.settings as Json | undefined,
        updated_by: context.authUser.id,
      }
    )

    if (typeof values.capacity === "number") {
      await this.organizationsRepository.updateHostelCapacity(
        values.organizationId,
        values.hostelId,
        {
          total_beds: values.capacity,
          notes: "Capacity synchronized from admin hostel settings.",
          updated_by: context.authUser.id,
        }
      )
    }

    await this.audit({
      action: "platform.hostel.updated",
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      tableName: "hostels",
      recordId: values.hostelId,
      actorUserId: context.authUser.id,
      oldValues: current,
      newValues: hostel,
    })

    return hostel
  }

  private async audit(input: {
    action: string
    organizationId: string
    hostelId: string | null
    tableName: string
    recordId: string
    actorUserId: string
    oldValues: unknown
    newValues: unknown
  }) {
    await this.organizationsRepository.createAuditLog({
      organization_id: input.organizationId,
      hostel_id: input.hostelId,
      actor_user_id: input.actorUserId,
      table_name: input.tableName,
      record_id: input.recordId,
      action: input.action,
      old_values: input.oldValues as Json | null,
      new_values: input.newValues as Json | null,
      metadata: {
        source: "admin_panel",
        operational_self_service: true,
      },
      request_id: getRequestId(),
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
  }
}

function jsonObjectOrEmpty(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value
}
