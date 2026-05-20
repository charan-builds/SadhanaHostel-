import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict, forbidden } from "@/lib/api/api-error"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { LeavesRepository } from "@/repositories/leaves.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  createLeaveRequestSchema,
  leaveListSchema,
  reviewLeaveRequestSchema,
} from "@/validations/leave.validation"

import { assertFound, AuthService } from "./auth.service"

export class LeavesService {
  private readonly authService: AuthService
  private readonly leavesRepository: LeavesRepository
  private readonly residentsRepository: ResidentsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.leavesRepository = new LeavesRepository(db)
    this.residentsRepository = new ResidentsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new LeavesService(db)
  }

  async listLeaves(input: unknown) {
    const values = leaveListSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    if (!context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role))) {
      const resident = await this.residentsRepository.getByUserId(
        context.authUser.id,
        values.organizationId
      )

      if (!resident || (values.residentId && values.residentId !== resident.id)) {
        throw forbidden("Residents can only view their own leave requests.")
      }

      return this.leavesRepository.list({
        ...values,
        residentId: resident.id,
      })
    }

    return this.leavesRepository.list(values)
  }

  async createLeave(input: unknown) {
    const values = createLeaveRequestSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = await this.residentsRepository.getById(
      values.residentId,
      values.organizationId
    )
    const existingResident = assertFound(resident, "Resident not found.")
    const isAdmin = context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role))

    if (!isAdmin && existingResident.user_id !== context.authUser.id) {
      throw forbidden("Residents can only apply leave for themselves.")
    }

    if (existingResident.hostel_id !== values.hostelId) {
      throw conflict("Leave hostel does not match resident hostel.")
    }

    return this.leavesRepository.create({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      resident_id: values.residentId,
      from_date: values.fromDate,
      to_date: values.toDate,
      reason: values.reason,
      destination: values.destination,
      travel_mode: values.travelMode,
      notes: values.notes,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }

  async reviewLeave(input: unknown) {
    const values = reviewLeaveRequestSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const leaveRequest = await this.leavesRepository.getById(
      values.leaveRequestId,
      values.organizationId
    )
    const existingLeave = assertFound(leaveRequest, "Leave request not found.")

    if (existingLeave.status !== "pending") {
      throw conflict("Only pending leave requests can be reviewed.")
    }

    if (values.status === "rejected" && !values.rejectionReason) {
      throw conflict("Rejection reason is required when rejecting leave.")
    }

    return this.leavesRepository.update(values.leaveRequestId, values.organizationId, {
      status: values.status,
      rejection_reason: values.status === "rejected" ? values.rejectionReason : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.authUser.id,
      updated_by: context.authUser.id,
      metadata: {
        parent_notification_pending: true,
      },
    })
  }
}
