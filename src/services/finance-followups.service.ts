import "server-only"

import { forbidden } from "@/lib/api/api-error"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CollectionFollowupsRepository,
  type CollectionFollowupRow,
} from "@/repositories/collection-followups.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  collectionFollowupCompleteSchema,
  collectionFollowupCreateSchema,
  collectionFollowupListSchema,
} from "@/validations/finance.validation"

import { assertFound, AuthService } from "./auth.service"

export class FinanceFollowupsService {
  private readonly authService: AuthService
  private readonly residentsRepository: ResidentsRepository
  private readonly followupsRepository: CollectionFollowupsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.residentsRepository = new ResidentsRepository(db)
    this.followupsRepository = new CollectionFollowupsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new FinanceFollowupsService(db)
  }

  async list(input: unknown): Promise<CollectionFollowupRow[]> {
    const values = collectionFollowupListSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    if (values.residentId) {
      const resident = assertFound(
        await this.residentsRepository.getById(values.residentId, values.organizationId),
        "Resident not found."
      )

      this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)
    } else {
      this.authService.requireHostelAccess(context, values.organizationId, hostelId)
    }

    return this.followupsRepository.list({
      organizationId: values.organizationId,
      hostelId,
      residentId: values.residentId,
      status: values.status,
      priority: values.priority,
      assignedTo: values.assignedTo,
      limit: values.limit,
    })
  }

  async create(input: unknown): Promise<CollectionFollowupRow> {
    const values = collectionFollowupCreateSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const resident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

    if (values.assignedTo && values.assignedTo !== context.authUser.id) {
      throw forbidden("Finance follow-ups can only be assigned to the current user.")
    }

    return this.followupsRepository.create({
      organization_id: values.organizationId,
      hostel_id: resident.hostel_id ?? values.hostelId ?? null,
      resident_id: resident.id,
      created_by: context.authUser.id,
      note: followupNotes(values),
      priority: values.priority,
      assigned_to: values.assignedTo ?? context.authUser.id,
      next_followup_at: values.nextFollowupAt ?? null,
      status: values.status,
      metadata: {
        source: "finance_collection_center",
      },
      updated_by: context.authUser.id,
    })
  }

  async complete(input: unknown): Promise<CollectionFollowupRow> {
    const values = collectionFollowupCompleteSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.followupsRepository.complete({
      id: values.followupId,
      organizationId: values.organizationId,
      actorUserId: context.authUser.id,
      note: values.notes ?? values.note,
    })
  }
}

function followupNotes(values: { note?: string; notes?: string }) {
  return values.notes ?? values.note ?? ""
}
