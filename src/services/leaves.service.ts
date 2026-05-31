import "server-only"

import { anyRoleHasPermission } from "@/constants/auth"
import { conflict, forbidden } from "@/lib/api/api-error"
import { logAuditEvent } from "@/lib/logger"
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
import {
  getResidentOnboardingRequirements,
  isResidentOperationallyVerified,
} from "./onboarding/resident-onboarding.policy"
import { RealtimeService } from "./realtime"

export class LeavesService {
  private readonly authService: AuthService
  private readonly leavesRepository: LeavesRepository
  private readonly residentsRepository: ResidentsRepository
  private readonly realtimeService: RealtimeService

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.leavesRepository = new LeavesRepository(db)
    this.residentsRepository = new ResidentsRepository(db)
    this.realtimeService = new RealtimeService(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new LeavesService(db)
  }

  async listLeaves(input: unknown) {
    const values = leaveListSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    if (!anyRoleHasPermission(context.roles, "leaves.manage")) {
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

    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.leavesRepository.list({
      ...values,
      ...(hostelId ? { hostelId } : {}),
    })
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
    const isAdmin = anyRoleHasPermission(context.roles, "leaves.manage")

    if (!isAdmin && existingResident.user_id !== context.authUser.id) {
      throw forbidden("Residents can only apply leave for themselves.")
    }

    if (isAdmin) {
      this.authService.requireHostelAccess(
        context,
        existingResident.organization_id,
        existingResident.hostel_id
      )
    }

    if (!isAdmin && !isResidentOperationallyVerified(existingResident)) {
      throw forbidden(getLeaveVerificationMessage(existingResident))
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
    const context = await this.authService.requirePermission("leaves.manage")

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const leaveRequest = await this.leavesRepository.getById(
      values.leaveRequestId,
      values.organizationId
    )
    const existingLeave = assertFound(leaveRequest, "Leave request not found.")

    this.authService.requireHostelAccess(
      context,
      existingLeave.organization_id,
      existingLeave.hostel_id
    )

    if (existingLeave.status !== "pending") {
      throw conflict("Only pending leave requests can be reviewed.")
    }

    if (values.status === "rejected" && !values.rejectionReason) {
      throw conflict("Rejection reason is required when rejecting leave.")
    }

    const updatedLeave = await this.leavesRepository.update(values.leaveRequestId, values.organizationId, {
      status: values.status,
      rejection_reason: values.status === "rejected" ? values.rejectionReason : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.authUser.id,
      updated_by: context.authUser.id,
      metadata: {
        parent_notification_pending: true,
      },
    })

    logAuditEvent({
      action: "leave.reviewed",
      actorUserId: context.authUser.id,
      organizationId: values.organizationId,
      targetTable: "leave_requests",
      targetId: values.leaveRequestId,
      outcome: "success",
      details: {
        status: values.status,
      },
    })

    await this.realtimeService.leaveStatusChanged({
      organizationId: updatedLeave.organization_id,
      hostelId: updatedLeave.hostel_id,
      actorUserId: context.authUser.id,
      leaveRequestId: updatedLeave.id,
      residentId: updatedLeave.resident_id,
      status: updatedLeave.status,
    })

    return updatedLeave
  }
}

function getLeaveVerificationMessage(
  resident: Parameters<typeof getResidentOnboardingRequirements>[0]
) {
  const requirements = getResidentOnboardingRequirements(resident)

  if (requirements.missing.length > 0) {
    return "Complete all onboarding requirements and submit them for verification before applying leave."
  }

  if (resident.onboarding_status === "verification_pending") {
    return "Your onboarding is pending admin verification. You can apply leave after approval."
  }

  return "Complete resident onboarding verification before applying leave."
}
