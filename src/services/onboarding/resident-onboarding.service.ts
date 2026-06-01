import "server-only"

import { conflict, forbidden } from "@/lib/api/api-error"
import { logAuditEvent, logger } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  ResidentsRepository,
  type ResidentWithOnboarding,
} from "@/repositories/residents.repository"
import { RoomsRepository } from "@/repositories/rooms.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"
import {
  onboardingProfileSchema,
  onboardingQueueSchema,
  onboardingReviewSchema,
  onboardingStatusQuerySchema,
  onboardingSubmitSchema,
} from "@/validations/onboarding.validation"

import { assertFound, AuthService } from "../auth.service"
import {
  getResidentOnboardingRequirements,
  isResidentOperationallyVerified,
} from "./resident-onboarding.policy"

export class ResidentOnboardingService {
  private readonly authService: AuthService
  private readonly residentsRepository: ResidentsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.residentsRepository = new ResidentsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new ResidentOnboardingService(db)
  }

  async getCurrentStatus(input: unknown) {
    const values = onboardingStatusQuerySchema.parse(input)
    const context = await this.authService.getCurrentContext()
    const organizationId = values.organizationId ?? context.organizationId

    if (!organizationId) {
      throw forbidden("Your account is not assigned to an organization.")
    }

    this.authService.requireOrganizationAccess(context, organizationId)

    const resident = assertFound(
      (await this.residentsRepository.getByUserId(
        context.authUser.id,
        organizationId
      )) as ResidentWithOnboarding | null,
      "Resident profile is not linked to this account yet."
    )

    return {
      resident,
      requirements: getResidentOnboardingRequirements(resident),
    }
  }

  async updateProfile(input: unknown) {
    const values = onboardingProfileSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = assertFound(
      (await this.residentsRepository.getByUserId(
        context.authUser.id,
        values.organizationId
      )) as ResidentWithOnboarding | null,
      "Resident profile is not linked to this account yet."
    )

    if (isResidentOperationallyVerified(resident)) {
      throw conflict("Verified residents must request admin changes for identity fields.")
    }

    const duplicatePhone = await this.residentsRepository.findDuplicateIdentity({
      organizationId: values.organizationId,
      residentId: resident.id,
      phone: values.phone,
    })

    if (duplicatePhone) {
      throw conflict("This phone number is already linked to another resident.")
    }

    if (values.aadhaarLast4) {
      const duplicateAadhaar = await this.residentsRepository.findDuplicateIdentity({
        organizationId: values.organizationId,
        residentId: resident.id,
        aadhaarLast4: values.aadhaarLast4,
        fullName: values.fullName,
      })

      if (duplicateAadhaar) {
        throw conflict("A resident with matching name and Aadhaar details already exists.")
      }
    }

    const metadata = {
      ...jsonObjectOrEmpty(resident.metadata),
      onboarding: {
        collegeName: values.collegeName,
        courseName: values.courseName,
        guardianRelation: values.guardianRelation,
        profileUpdatedAt: new Date().toISOString(),
      },
    }
    const updated = await this.residentsRepository.updateExtended(
      resident.id,
      values.organizationId,
      {
        full_name: values.fullName,
        preferred_name: values.preferredName ?? null,
        gender: values.gender ?? null,
        date_of_birth: values.dateOfBirth,
        phone: values.phone,
        email: values.email ?? null,
        parent_name: values.parentName,
        parent_phone: values.parentPhone,
        parent_email: values.parentEmail ?? null,
        emergency_contact_name: values.emergencyContactName,
        emergency_contact_phone: values.emergencyContactPhone,
        permanent_address: values.permanentAddress,
        aadhaar_last4: values.aadhaarLast4 ?? null,
        metadata: metadata as Json,
        onboarding_status: resident.aadhaar_document_id &&
          resident.profile_image_document_id &&
          resident.student_id_document_id
          ? "documents_pending"
          : "profile_incomplete",
        updated_by: context.authUser.id,
      }
    )

    return {
      resident: updated,
      requirements: getResidentOnboardingRequirements(updated),
    }
  }

  async submitForVerification(input: unknown) {
    const values = onboardingSubmitSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = assertFound(
      (await this.residentsRepository.getByUserId(
        context.authUser.id,
        values.organizationId
      )) as ResidentWithOnboarding | null,
      "Resident profile is not linked to this account yet."
    )
    const requirements = getResidentOnboardingRequirements(resident)

    if (!requirements.canSubmitForVerification) {
      throw conflict("Complete all required profile and document items first.", {
        missing: requirements.missing,
      })
    }

    const updated = await this.completeOnboardingWithoutAdminReview(
      resident,
      values.organizationId,
      context.authUser.id
    )

    logAuditEvent({
      action: "resident.onboarding_completed",
      actorUserId: context.authUser.id,
      organizationId: values.organizationId,
      targetTable: "residents",
      targetId: resident.id,
      outcome: "success",
      details: {
        completionMode: "resident_self_completion",
        adminReviewRequired: false,
      },
    })

    return {
      resident: updated,
      requirements: getResidentOnboardingRequirements(updated),
    }
  }

  private async completeOnboardingWithoutAdminReview(
    resident: ResidentWithOnboarding,
    organizationId: string,
    actorUserId: string
  ) {
    const adminDb = createSupabaseAdminClient()
    const adminResidentsRepository = new ResidentsRepository(adminDb)
    const now = new Date().toISOString()
    let updated = await adminResidentsRepository.updateExtended(
      resident.id,
      organizationId,
      {
        onboarding_status: "verified",
        onboarding_rejection_reason: null,
        onboarding_completed_at: resident.onboarding_completed_at ?? now,
        onboarding_verified_at: now,
        onboarding_verified_by: actorUserId,
        status: "active",
        updated_by: actorUserId,
      }
    )

    await this.activateRequestedRoomIfPossible(adminDb, updated, actorUserId)

    updated =
      ((await adminResidentsRepository.getById(
        resident.id,
        organizationId
      )) as ResidentWithOnboarding | null) ?? updated

    return updated
  }

  private async activateRequestedRoomIfPossible(
    adminDb: AppSupabaseClient,
    resident: ResidentWithOnboarding,
    actorUserId: string
  ) {
    if (!resident.hostel_id) {
      return
    }

    const requestedRoom = getRequestedRoomAssignment(resident)

    if (!requestedRoom.roomId) {
      return
    }

    const roomsRepository = new RoomsRepository(adminDb)
    const existingAllocation = await roomsRepository.getActiveAllocationForResidentInHostel(
      resident.id,
      resident.organization_id,
      resident.hostel_id
    )

    if (existingAllocation) {
      return
    }

    try {
      await roomsRepository.allocateRoomAtomic({
        organizationId: resident.organization_id,
        hostelId: resident.hostel_id,
        roomId: requestedRoom.roomId,
        residentId: resident.id,
        bedLabel: requestedRoom.bedLabel ?? undefined,
        allocatedFrom: requestedRoom.allocatedFrom ?? new Date().toISOString().slice(0, 10),
        monthlyFeeAmount: resident.monthly_fee_amount,
        reason: "Resident completed onboarding; activating preferred room from admission.",
        actorUserId,
      })
    } catch (error) {
      logger.warn({
        event: "resident.onboarding_preferred_room_activation_failed",
        message: "Resident onboarding completed, but preferred room could not be allocated.",
        organizationId: resident.organization_id,
        userId: actorUserId,
        error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
        metadata: {
          residentId: resident.id,
          roomId: requestedRoom.roomId,
        },
      })
    }
  }

  async listVerificationQueue(input: unknown) {
    const values = onboardingQueueSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.residentsRepository.listOnboardingQueue({
      organizationId: values.organizationId,
      hostelId: hostelId ?? undefined,
      search: values.search,
      page: values.page,
      pageSize: values.pageSize,
      onboardingStatuses: values.onboardingStatus
        ? [values.onboardingStatus]
        : ["profile_incomplete", "documents_pending", "verification_pending", "rejected"],
    })
  }

  async review(input: unknown) {
    const values = onboardingReviewSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")

    const resident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

    const updated = await this.residentsRepository.transitionOnboarding({
      organizationId: values.organizationId,
      residentId: values.residentId,
      nextStatus: values.status,
      rejectionReason: values.rejectionReason,
      actorUserId: context.authUser.id,
    })

    logAuditEvent({
      action: "resident.onboarding_reviewed",
      actorUserId: context.authUser.id,
      organizationId: values.organizationId,
      targetTable: "residents",
      targetId: values.residentId,
      outcome: "success",
      details: {
        status: values.status,
      },
    })

    return {
      resident: updated,
      requirements: getResidentOnboardingRequirements(updated),
    }
  }
}

function jsonObjectOrEmpty(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value
}

function getRequestedRoomAssignment(resident: ResidentWithOnboarding) {
  const metadata = jsonObjectOrEmpty(resident.metadata)
  const requested =
    metadata.requested_room_assignment &&
    typeof metadata.requested_room_assignment === "object" &&
    !Array.isArray(metadata.requested_room_assignment)
      ? (metadata.requested_room_assignment as Record<string, unknown>)
      : {}
  const roomId = typeof requested.room_id === "string" ? requested.room_id : null
  const bedLabel = typeof requested.bed_label === "string" ? requested.bed_label : null
  const allocatedFrom =
    typeof requested.allocated_from === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(requested.allocated_from)
      ? requested.allocated_from
      : null

  return {
    roomId,
    bedLabel,
    allocatedFrom,
  }
}
