import "server-only"

import { randomUUID } from "node:crypto"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict, forbidden } from "@/lib/api/api-error"
import { logger } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { RealtimeEventPublisher } from "@/services/realtime/event-publisher"
import type { RealtimeEventType } from "@/services/realtime/event-types"
import {
  checkoutResidentSchema,
  createResidentSchema,
  residentIdMutationSchema,
  residentListSchema,
  updateOwnResidentProfileSchema,
  updateResidentSchema,
} from "@/validations/resident.validation"

import { assertFound, AuthService } from "./auth.service"

export class ResidentsService {
  private readonly authService: AuthService
  private readonly residentsRepository: ResidentsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.residentsRepository = new ResidentsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new ResidentsService(db)
  }

  async listResidents(input: unknown) {
    const values = residentListSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.residentsRepository.list({
      ...values,
      ...(hostelId ? { hostelId } : {}),
    })
  }

  async getResident(residentId: string, organizationId: string) {
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, organizationId)

    const resident = await this.residentsRepository.getById(residentId, organizationId)
    const isOwnProfile = resident?.user_id === context.authUser.id

    if (context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role)) && resident) {
      this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)
    }

    if (!context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role)) && !isOwnProfile) {
      throw forbidden("Residents can only access their own profile.")
    }

    return assertFound(resident, "Resident not found.")
  }

  async getCurrentResident(organizationId?: string) {
    const context = await this.authService.getCurrentContext()
    const targetOrganizationId = organizationId ?? context.organizationId

    if (!targetOrganizationId) {
      throw forbidden("Your account is not assigned to an organization yet.")
    }

    this.authService.requireOrganizationAccess(context, targetOrganizationId)

    const resident = await this.residentsRepository.getByUserId(
      context.authUser.id,
      targetOrganizationId
    )

    return assertFound(resident, "Resident profile is not linked to this account yet.")
  }

  async createResident(input: unknown) {
    const values = createResidentSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const duplicate = await this.residentsRepository.findAdmissionDuplicate({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      phone: values.phone,
      email: values.email,
    })

    if (duplicate) {
      throw duplicateResidentConflict(duplicate)
    }

    const resident = await this.createDraftResident(values, context.authUser.id)
    const currentResident =
      (await this.residentsRepository.getById(resident.id, values.organizationId)) ?? resident

    await this.publishResidentEvent("resident.created", currentResident, context.authUser.id)

    return currentResident
  }

  private async createDraftResident(
    values: ReturnType<typeof createResidentSchema.parse>,
    actorUserId: string
  ) {
    try {
      return await this.residentsRepository.create({
        organization_id: values.organizationId,
        hostel_id: values.hostelId,
        admission_number:
          normalizeOptionalText(values.admissionNumber) ?? generateDraftAdmissionNumber(),
        full_name: values.fullName,
        preferred_name: values.preferredName,
        resident_type: values.residentType,
        gender: values.gender,
        date_of_birth: values.dateOfBirth,
        phone: values.phone,
        email: values.email,
        parent_name: values.parentName,
        parent_phone: values.parentPhone,
        parent_email: values.parentEmail,
        emergency_contact_name: values.emergencyContactName,
        emergency_contact_phone: values.emergencyContactPhone,
        permanent_address: values.permanentAddress,
        monthly_fee_amount: values.monthlyFeeAmount,
        security_deposit_amount: values.securityDepositAmount,
        notes: values.notes,
        status: "draft",
        metadata: {
          admission_flow: "quick_admin_create",
          profile_completion_required: true,
          whatsapp_onboarding_ready: true,
          ...(values.roomId
            ? {
                requested_room_assignment: {
                  room_id: values.roomId,
                  bed_label: normalizeOptionalText(values.bedLabel) ?? null,
                  allocated_from: values.allocatedFrom ?? null,
                },
              }
            : {}),
        },
        created_by: actorUserId,
        updated_by: actorUserId,
      })
    } catch (error) {
      throw mapResidentCreateError(error)
    }
  }

  async updateResident(input: unknown) {
    const values = updateResidentSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    const existingResident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(
      context,
      existingResident.organization_id,
      existingResident.hostel_id
    )

    const resident = await this.residentsRepository.update(values.residentId, values.organizationId, {
      full_name: values.fullName,
      preferred_name: values.preferredName,
      resident_type: values.residentType,
      gender: values.gender,
      date_of_birth: values.dateOfBirth,
      phone: values.phone,
      email: values.email,
      parent_name: values.parentName,
      parent_phone: values.parentPhone,
      parent_email: values.parentEmail,
      emergency_contact_name: values.emergencyContactName,
      emergency_contact_phone: values.emergencyContactPhone,
      permanent_address: values.permanentAddress,
      monthly_fee_amount: values.monthlyFeeAmount,
      security_deposit_amount: values.securityDepositAmount,
      notes: values.notes,
      status: values.status,
      updated_by: context.authUser.id,
    })

    await this.publishResidentEvent("resident.updated", resident, context.authUser.id)

    return resident
  }

  async updateCurrentResident(input: unknown) {
    const values = updateOwnResidentProfileSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = assertFound(
      await this.residentsRepository.getByUserId(context.authUser.id, values.organizationId),
      "Resident profile is not linked to this account yet."
    )

    return this.residentsRepository.update(resident.id, values.organizationId, {
      preferred_name: values.preferredName,
      phone: values.phone,
      email: values.email,
      parent_name: values.parentName,
      parent_phone: values.parentPhone,
      parent_email: values.parentEmail,
      emergency_contact_name: values.emergencyContactName,
      emergency_contact_phone: values.emergencyContactPhone,
      permanent_address: values.permanentAddress,
      updated_by: context.authUser.id,
    })
  }

  async onboardResident(residentId: string, userId: string) {
    const context = await this.authService.requireAdmin()
    const resident = assertFound(
      await this.residentsRepository.getById(residentId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

    const { data, error } = await createSupabaseAdminClient().rpc("onboard_resident", {
      target_resident_id: residentId,
      target_user_id: userId,
    })

    if (error) {
      throw forbidden(error.message)
    }

    return data
  }

  async deactivateResident(input: unknown) {
    const values = residentIdMutationSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    const existingResident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(
      context,
      existingResident.organization_id,
      existingResident.hostel_id
    )

    const resident = await this.residentsRepository.deactivate(
      values.residentId,
      values.organizationId,
      context.authUser.id
    )

    await this.publishResidentEvent("resident.deactivated", resident, context.authUser.id)

    return resident
  }

  async checkoutResident(input: unknown) {
    const values = checkoutResidentSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    const existingResident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(
      context,
      existingResident.organization_id,
      existingResident.hostel_id
    )

    try {
      const resident = await this.residentsRepository.checkout({
        residentId: values.residentId,
        organizationId: values.organizationId,
        checkoutDate: values.checkoutDate ?? new Date().toISOString().slice(0, 10),
        reason: values.reason ?? "Resident checked out from admin residents workflow.",
        actorUserId: context.authUser.id,
      })

      await this.publishResidentEvent("resident.checked_out", resident, context.authUser.id)

      return resident
    } catch (error) {
      throw mapResidentAllocationError(error)
    }
  }

  private async publishResidentEvent(
    type: RealtimeEventType,
    resident: { id: string; organization_id: string; hostel_id: string | null },
    actorUserId: string,
    metadata?: { allocatedRoomId?: string | null }
  ) {
    try {
      const publisher = new RealtimeEventPublisher()
      const payload = {
        residentId: resident.id,
        hostelId: resident.hostel_id,
        allocatedRoomId: metadata?.allocatedRoomId ?? null,
      }

      await Promise.all([
        publisher.publish({
          type,
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
          actorUserId,
          payload,
        }),
        publisher.publish({
          type: "vacancy.changed",
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
          actorUserId,
          payload: {
            reason: type,
            residentId: resident.id,
            allocatedRoomId: metadata?.allocatedRoomId ?? null,
          },
        }),
        publisher.publish({
          type: "dashboard.refresh",
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
          actorUserId,
          payload: {
            reason: type,
            residentId: resident.id,
          },
        }),
      ])
    } catch (error) {
      logger.warn({
        event: "resident.realtime_publish_failed",
        message: "Resident lifecycle completed, but realtime refresh could not be published.",
        organizationId: resident.organization_id,
        userId: actorUserId,
        error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
        metadata: { residentId: resident.id, eventType: type },
      })
    }
  }
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim()

  return normalized || undefined
}

function generateDraftAdmissionNumber() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const suffix = randomUUID().slice(0, 8).toUpperCase()

  return `DRAFT-${timestamp}-${suffix}`
}

function duplicateResidentConflict(
  duplicate: NonNullable<
    Awaited<ReturnType<ResidentsRepository["findAdmissionDuplicate"]>>
  >
): never {
  const resident = duplicate.resident

  throw conflict(
    "Resident already exists. Continue their onboarding or resend activation instead of creating a duplicate.",
    {
      type: "resident_duplicate",
      matchedFields: duplicate.matchedFields,
      resident: {
        id: resident.id,
        fullName: resident.full_name,
        admissionNumber: resident.admission_number,
        phone: resident.phone,
        email: resident.email,
        status: resident.status,
        hasPortalAccount: Boolean(resident.user_id),
      },
      actions: [
        "open_resident",
        "continue_onboarding",
        "resend_activation",
        "merge_draft",
      ],
    }
  )
}

function mapResidentCreateError(error: unknown): never {
  const message = error instanceof Error ? error.message : ""

  if (
    message.includes("residents_admission_uidx") ||
    message.includes("duplicate key value violates unique constraint")
  ) {
    throw conflict(
      "A resident with this admission number or verified contact already exists. Open the existing resident to continue onboarding.",
      {
        type: "resident_duplicate_constraint",
        actions: ["open_resident", "continue_onboarding", "resend_activation"],
      }
    )
  }

  throw error
}

function mapResidentAllocationError(error: unknown): never {
  const message = error instanceof Error ? error.message : ""

  if (message.includes("room_capacity_exceeded")) {
    throw conflict("Room is already full. Choose another room or run occupancy recalculation.")
  }

  if (message.includes("resident_already_allocated")) {
    throw conflict("Resident already has an active room allocation.")
  }

  if (message.includes("room_not_allocatable")) {
    throw conflict("Room is not available for allocation.")
  }

  if (message.includes("resident_not_allocatable")) {
    throw conflict("Resident is not eligible for room allocation.")
  }

  if (message.includes("resident_not_found")) {
    throw conflict("Resident not found.")
  }

  if (message.includes("room_not_found")) {
    throw conflict("Room not found.")
  }

  throw error
}
