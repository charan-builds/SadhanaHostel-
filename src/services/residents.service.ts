import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { forbidden } from "@/lib/api/api-error"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  createResidentSchema,
  residentIdMutationSchema,
  residentListSchema,
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

  async createResident(input: unknown) {
    const values = createResidentSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.residentsRepository.create({
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
  }

  async updateResident(input: unknown) {
    const values = updateResidentSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.residentsRepository.update(values.residentId, values.organizationId, {
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
  }

  async onboardResident(residentId: string, userId: string) {
    await this.authService.requireAdmin()

    return this.residentsRepository.linkUser(residentId, userId)
  }

  async deactivateResident(input: unknown) {
    const values = residentIdMutationSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.residentsRepository.deactivate(
      values.residentId,
      values.organizationId,
      context.authUser.id
    )
  }
}
