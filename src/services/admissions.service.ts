import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { badRequest, conflict } from "@/lib/api/api-error"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdmissionsRepository } from "@/repositories/admissions.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { RealtimeEventPublisher } from "@/services/realtime"
import type { Json, Tables } from "@/types/database"
import {
  addLeadNoteSchema,
  cancelReservationSchema,
  convertReservationSchema,
  createLeadSchema,
  createReservationPaymentSchema,
  createReservationSchema,
  leadListSchema,
  publicInquirySchema,
  reservationIdSchema,
  reservationListSchema,
  updateLeadSchema,
  vacancyQuerySchema,
  verifyReservationPaymentSchema,
} from "@/validations/admission.validation"

import { assertFound, AuthService } from "./auth.service"

const ADMISSION_ADMIN_ROLES = [...ADMIN_ROLES, "staff"] as const

export class AdmissionsService {
  private readonly authService: AuthService
  private readonly admissionsRepository: AdmissionsRepository
  private readonly eventPublisher: RealtimeEventPublisher

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.admissionsRepository = new AdmissionsRepository(db)
    this.eventPublisher = new RealtimeEventPublisher()
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new AdmissionsService(db)
  }

  static createPublic() {
    return new AdmissionsService(createSupabaseAdminClient())
  }

  async getPublicVacancy(input: unknown) {
    const values = vacancyQuerySchema.parse(input)
    const tenant = await this.resolveTenant(values.organizationId, values.hostelId)

    return this.buildVacancyPayload(tenant.organizationId, tenant.hostelId)
  }

  async getVacancy(input: unknown) {
    const values = vacancyQuerySchema.parse(input)
    const tenant = await this.resolveTenant(values.organizationId, values.hostelId)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, tenant.organizationId)

    return this.buildVacancyPayload(tenant.organizationId, tenant.hostelId)
  }

  async listLeads(input: unknown) {
    const values = leadListSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.admissionsRepository.listLeads(values)
  }

  async createLead(input: unknown) {
    const values = createLeadSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const lead = await this.admissionsRepository.createLead({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      full_name: values.fullName,
      phone: values.phone,
      whatsapp_number: values.whatsappNumber,
      email: values.email,
      resident_type: values.residentType,
      desired_joining_date: values.desiredJoiningDate,
      expected_stay_duration: values.expectedStayDuration,
      parent_name: values.parentName,
      parent_phone: values.parentPhone,
      notes: values.notes,
      source: values.source,
      status: values.status,
      next_follow_up_at: values.nextFollowUpAt,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
      metadata: {
        created_from: "admin",
      } satisfies Json,
    })

    await this.publish("lead.created", lead.organization_id, lead.hostel_id, context.authUser.id, {
      leadId: lead.id,
      status: lead.status,
      source: lead.source,
    })

    return lead
  }

  async createPublicInquiry(input: unknown) {
    const values = publicInquirySchema.parse(input)
    const tenant = await this.resolveTenant(values.organizationId, values.hostelId)
    const recentDuplicate = await this.admissionsRepository.findRecentLeadByPhone(
      tenant.organizationId,
      tenant.hostelId,
      values.phone,
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    )

    if (recentDuplicate) {
      return {
        id: recentDuplicate.id,
        status: recentDuplicate.status,
        createdAt: recentDuplicate.created_at,
        deduplicated: true,
      }
    }

    const lead = await this.admissionsRepository.createLead({
      organization_id: tenant.organizationId,
      hostel_id: tenant.hostelId,
      full_name: values.fullName,
      phone: values.phone,
      whatsapp_number: values.whatsappNumber ?? values.phone,
      email: values.email,
      resident_type: values.residentType,
      desired_joining_date: values.desiredJoiningDate,
      expected_stay_duration: values.expectedStayDuration,
      parent_name: values.parentName,
      parent_phone: values.parentPhone,
      notes: values.notes,
      source: values.source,
      status: "new_inquiry",
      metadata: {
        created_from: "public_website",
      } satisfies Json,
    })

    await this.publish("lead.created", lead.organization_id, lead.hostel_id, null, {
      leadId: lead.id,
      status: lead.status,
      source: lead.source,
    })

    return {
      id: lead.id,
      status: lead.status,
      createdAt: lead.created_at,
      deduplicated: false,
    }
  }

  async updateLead(input: unknown) {
    const values = updateLeadSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const lead = await this.admissionsRepository.updateLead(
      values.leadId,
      values.organizationId,
      {
        hostel_id: values.hostelId,
        full_name: values.fullName,
        phone: values.phone,
        whatsapp_number: values.whatsappNumber,
        email: values.email,
        resident_type: values.residentType,
        desired_joining_date: values.desiredJoiningDate,
        expected_stay_duration: values.expectedStayDuration,
        parent_name: values.parentName,
        parent_phone: values.parentPhone,
        notes: values.notes,
        source: values.source,
        status: values.status,
        assigned_to: values.assignedTo,
        last_contacted_at: values.lastContactedAt,
        next_follow_up_at: values.nextFollowUpAt,
        cancelled_reason: values.cancelledReason,
        updated_by: context.authUser.id,
      }
    )

    await this.publish("lead.updated", lead.organization_id, lead.hostel_id, context.authUser.id, {
      leadId: lead.id,
      status: lead.status,
    })

    return lead
  }

  async addLeadNote(input: unknown) {
    const values = addLeadNoteSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.admissionsRepository.addLeadNote({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      lead_id: values.leadId,
      note: values.note,
      is_pinned: values.isPinned,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }

  async listReservations(input: unknown) {
    const values = reservationListSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.admissionsRepository.listReservations(values)
  }

  async createReservation(input: unknown) {
    const values = createReservationSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    try {
      const reservation = await this.admissionsRepository.createReservationAtomic({
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        leadId: values.leadId,
        reservedRoomId: values.reservedRoomId,
        reservedBedCount: values.reservedBedCount,
        reservedUntil: values.reservedUntil,
        advanceAmount: values.advanceAmount,
        notes: values.notes,
        actorUserId: context.authUser.id,
      })

      await this.publish(
        "reservation.created",
        reservation.organization_id,
        reservation.hostel_id,
        context.authUser.id,
        {
          reservationId: reservation.id,
          leadId: reservation.lead_id,
          reservedBedCount: reservation.reserved_bed_count,
        }
      )
      await this.publish("vacancy.changed", reservation.organization_id, reservation.hostel_id, context.authUser.id, {
        reason: "reservation_created",
      })

      return reservation
    } catch (error) {
      throw mapAdmissionConflict(error)
    }
  }

  async confirmReservation(input: unknown) {
    const values = reservationIdSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const reservation = await this.admissionsRepository.updateReservation(
      values.reservationId,
      values.organizationId,
      {
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        updated_by: context.authUser.id,
      }
    )

    await this.admissionsRepository.updateLead(reservation.lead_id, values.organizationId, {
      status: "confirmed",
      updated_by: context.authUser.id,
    })
    await this.publish(
      "reservation.confirmed",
      reservation.organization_id,
      reservation.hostel_id,
      context.authUser.id,
      { reservationId: reservation.id, leadId: reservation.lead_id }
    )

    return reservation
  }

  async cancelReservation(input: unknown) {
    const values = cancelReservationSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const reservation = await this.admissionsRepository.updateReservation(
      values.reservationId,
      values.organizationId,
      {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        notes: values.reason,
        updated_by: context.authUser.id,
      }
    )

    await this.admissionsRepository.updateLead(reservation.lead_id, values.organizationId, {
      status: "interested",
      updated_by: context.authUser.id,
    })
    await this.admissionsRepository.recalculateHostelCapacity(
      reservation.organization_id,
      reservation.hostel_id
    )
    await this.publish("vacancy.changed", reservation.organization_id, reservation.hostel_id, context.authUser.id, {
      reason: "reservation_cancelled",
    })

    return reservation
  }

  async createReservationPayment(input: unknown) {
    const values = createReservationPaymentSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.admissionsRepository.createReservationPayment({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      reservation_id: values.reservationId,
      lead_id: values.leadId,
      amount: values.amount,
      method: values.method,
      status: values.proofDocumentId ? "proof_uploaded" : "pending",
      transaction_id: values.transactionId,
      proof_document_id: values.proofDocumentId,
      paid_at: values.paidAt,
      notes: values.notes,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }

  async verifyReservationPayment(input: unknown) {
    const values = verifyReservationPaymentSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    try {
      const payment = await this.admissionsRepository.verifyReservationPaymentAtomic({
        organizationId: values.organizationId,
        paymentId: values.paymentId,
        actorUserId: context.authUser.id,
        notes: values.notes,
      })

      await this.publish(
        "reservation.confirmed",
        payment.organization_id,
        payment.hostel_id,
        context.authUser.id,
        { reservationId: payment.reservation_id, paymentId: payment.id }
      )

      return payment
    } catch (error) {
      throw mapAdmissionConflict(error)
    }
  }

  async convertReservation(input: unknown) {
    const values = convertReservationSchema.parse(input)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    try {
      const resident = (await this.admissionsRepository.convertReservationAtomic({
        organizationId: values.organizationId,
        reservationId: values.reservationId,
        joinedOn: values.joinedOn,
        monthlyFeeAmount: values.monthlyFeeAmount,
        securityDepositAmount: values.securityDepositAmount,
        actorUserId: context.authUser.id,
      })) as Tables<"residents">

      const reservation = assertFound(
        await this.admissionsRepository.getReservationById(
          values.reservationId,
          values.organizationId
        ),
        "Reservation not found after conversion."
      )

      await this.publish(
        "reservation.converted",
        reservation.organization_id,
        reservation.hostel_id,
        context.authUser.id,
        { reservationId: reservation.id, residentId: resident.id }
      )
      await this.publish("vacancy.changed", reservation.organization_id, reservation.hostel_id, context.authUser.id, {
        reason: "reservation_converted",
      })

      return resident
    } catch (error) {
      throw mapAdmissionConflict(error)
    }
  }

  async getAnalytics(input: unknown) {
    const values = vacancyQuerySchema.parse(input)
    const tenant = await this.resolveTenant(values.organizationId, values.hostelId)
    const context = await this.authService.requireRole(ADMISSION_ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, tenant.organizationId)

    return this.admissionsRepository.getAnalytics(tenant.organizationId, tenant.hostelId)
  }

  private async buildVacancyPayload(organizationId: string, hostelId?: string) {
    const [hostels, rooms] = await Promise.all([
      this.admissionsRepository.getVacancy(organizationId, hostelId),
      this.admissionsRepository.listRoomVacancy(organizationId, hostelId),
    ])

    return {
      hostels,
      rooms,
      summary: hostels[0] ?? null,
    }
  }

  private publish(
    type: Parameters<RealtimeEventPublisher["publish"]>[0]["type"],
    organizationId: string,
    hostelId: string | null,
    actorUserId: string | null,
    payload: Json
  ) {
    return this.eventPublisher.publish({
      type,
      organizationId,
      hostelId,
      actorUserId,
      payload,
    })
  }

  private async resolveTenant(organizationId?: string, hostelId?: string) {
    const resolvedOrganizationId =
      organizationId || process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
    const resolvedHostelId = hostelId || process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID

    if (resolvedOrganizationId) {
      return {
        organizationId: resolvedOrganizationId,
        hostelId: resolvedHostelId || undefined,
      }
    }

    throw badRequest("Organization context is required for admissions.")
  }
}

function mapAdmissionConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : ""

  if (message.includes("hostel_capacity_exceeded")) {
    throw conflict("Not enough hostel vacancy is available for this reservation.")
  }

  if (message.includes("room_capacity_exceeded")) {
    throw conflict("The selected room does not have enough available beds.")
  }

  if (message.includes("lead_not_found")) {
    throw conflict("Lead is not available for reservation.")
  }

  if (message.includes("lead_not_reservable")) {
    throw conflict("Lead cannot be reserved in its current status.")
  }

  if (message.includes("reservation_not_convertible")) {
    throw conflict("Reservation cannot be converted in its current status.")
  }

  if (message.includes("payment_proof_required")) {
    throw conflict("UPI advance verification requires an uploaded payment proof.")
  }

  throw error
}
