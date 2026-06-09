import "server-only"

import { conflict, forbidden } from "@/lib/api/api-error"
import { logAuditEvent } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { HOSTEL_RULES_VERSION } from "@/constants/hostel"
import {
  ResidentsRepository,
  type ResidentWithOnboarding,
} from "@/repositories/residents.repository"
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
  hasAcceptedCurrentHostelRules,
  isResidentEligibleForSelfOnboarding,
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

    const residentMetadata = jsonObjectOrEmpty(resident.metadata)
    const onboardingMetadata = jsonObjectOrEmpty(residentMetadata.onboarding)
    const metadata = {
      ...residentMetadata,
      onboarding: {
        ...onboardingMetadata,
        collegeName: values.collegeName,
        courseName: values.courseName,
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
        parent_name: "Father",
        parent_phone: values.parentPhone,
        parent_email: null,
        emergency_contact_name: "Mother",
        emergency_contact_phone: values.emergencyContactPhone,
        permanent_address: values.permanentAddress,
        metadata: metadata as Json,
        onboarding_status: "profile_incomplete",
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
    const residentWithRulesAcceptance = withHostelRulesAcceptance(
      resident,
      context.authUser.id
    )
    const requirements = getResidentOnboardingRequirements(residentWithRulesAcceptance)

    if (!isResidentEligibleForSelfOnboarding(residentWithRulesAcceptance)) {
      throw conflict(
        "This resident account cannot be activated from self-onboarding. Contact hostel administration."
      )
    }

    if (!requirements.canSubmitForVerification) {
      throw conflict("Complete all required profile and hostel rules items first.", {
        missing: requirements.missing,
      })
    }

    const updated = await this.completeOnboardingWithoutAdminReview(
      residentWithRulesAcceptance,
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
        hostelRulesAccepted: true,
        hostelRulesVersion: HOSTEL_RULES_VERSION,
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

    return adminResidentsRepository.completeSelfOnboarding({
      residentId: resident.id,
      organizationId,
      actorUserId,
      rulesVersion: HOSTEL_RULES_VERSION,
    })
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

function jsonObjectOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function withHostelRulesAcceptance(
  resident: ResidentWithOnboarding,
  actorUserId: string
): ResidentWithOnboarding {
  if (hasAcceptedCurrentHostelRules(resident)) {
    return resident
  }

  const metadata = jsonObjectOrEmpty(resident.metadata)
  const onboarding = jsonObjectOrEmpty(metadata.onboarding)

  return {
    ...resident,
    metadata: {
      ...metadata,
      onboarding: {
        ...onboarding,
        hostelRulesAcceptance: {
          accepted: true,
          version: HOSTEL_RULES_VERSION,
          acceptedAt: new Date().toISOString(),
          acceptedByUserId: actorUserId,
        },
      },
    } as Json,
  }
}
