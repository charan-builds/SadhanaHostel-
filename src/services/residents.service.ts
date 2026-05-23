import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict, forbidden } from "@/lib/api/api-error"
import { logger } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ResidentsRepository } from "@/repositories/residents.repository"
import { RoomsRepository } from "@/repositories/rooms.repository"
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
  private readonly roomsRepository: RoomsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.residentsRepository = new ResidentsRepository(db)
    this.roomsRepository = new RoomsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new ResidentsService(db)
  }

  async listResidents(input: unknown) {
    const values = residentListSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.residentsRepository.list(values)
  }

  async getResident(residentId: string, organizationId: string) {
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, organizationId)

    const resident = await this.residentsRepository.getById(residentId, organizationId)
    const isOwnProfile = resident?.user_id === context.authUser.id

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

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = await this.residentsRepository.create({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      admission_number: values.admissionNumber,
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
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    let allocatedRoomId: string | null = null

    if (values.roomId) {
      try {
        const allocation = await this.roomsRepository.allocateRoomAtomic({
          organizationId: values.organizationId,
          hostelId: values.hostelId,
          roomId: values.roomId,
          residentId: resident.id,
          bedLabel: normalizeOptionalText(values.bedLabel),
          allocatedFrom: values.allocatedFrom ?? new Date().toISOString().slice(0, 10),
          monthlyFeeAmount: values.monthlyFeeAmount,
          reason: "Initial resident creation room assignment.",
          actorUserId: context.authUser.id,
        })
        allocatedRoomId = allocation.room_id
      } catch (error) {
        await this.rollbackResidentAfterAllocationFailure(
          resident.id,
          values.organizationId,
          context.authUser.id
        )
        throw mapResidentAllocationError(error)
      }
    }

    const currentResident =
      (await this.residentsRepository.getById(resident.id, values.organizationId)) ?? resident

    await this.publishResidentEvent("resident.created", currentResident, context.authUser.id, {
      allocatedRoomId,
    })

    return currentResident
  }

  async updateResident(input: unknown) {
    const values = updateResidentSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

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

    this.authService.requireOrganizationAccess(context, resident.organization_id)

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

    this.authService.requireOrganizationAccess(context, values.organizationId)

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

    this.authService.requireOrganizationAccess(context, values.organizationId)

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

  private async rollbackResidentAfterAllocationFailure(
    residentId: string,
    organizationId: string,
    actorUserId: string
  ) {
    try {
      await this.residentsRepository.deactivate(residentId, organizationId, actorUserId)
    } catch (rollbackError) {
      logger.warn({
        event: "resident.create_allocation_rollback_failed",
        message: "Resident creation allocation rollback failed; consistency scanner will surface the draft record.",
        organizationId,
        userId: actorUserId,
        metadata: { residentId },
        error: rollbackError instanceof Error
          ? { name: rollbackError.name, message: rollbackError.message }
          : undefined,
      })
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
