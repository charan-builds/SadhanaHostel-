import "server-only"

import { badRequest, conflict, notFound } from "@/lib/api/api-error"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ResidentsRepository } from "@/repositories/residents.repository"
import { throwRepositoryError, type AppSupabaseClient } from "@/repositories/types"
import { RealtimeService } from "@/services/realtime"
import {
  financialCorrectionResultSchema,
  financialCorrectionSchema,
  type FinancialCorrectionResult,
} from "@/validations/financial-correction.validation"

import { assertFound, AuthService } from "./auth.service"

type FinancialCorrectionRpcClient = {
  rpc(
    functionName: "apply_resident_financial_correction_atomic",
    args: {
      p_organization_id: string
      p_resident_id: string
      p_change_type: FinancialCorrectionResult["changeType"]
      p_new_value: number
      p_reason: string
      p_actor_user_id: string
    }
  ): Promise<{
    data: unknown
    error: Parameters<typeof throwRepositoryError>[0]
  }>
}

export class FinancialCorrectionsService {
  private readonly authService: AuthService
  private readonly residentsRepository: ResidentsRepository
  private readonly realtimeService: RealtimeService

  constructor(
    private readonly db: AppSupabaseClient,
    private readonly adminDb: AppSupabaseClient = createSupabaseAdminClient()
  ) {
    this.authService = new AuthService(db)
    this.residentsRepository = new ResidentsRepository(db)
    this.realtimeService = new RealtimeService(adminDb)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new FinancialCorrectionsService(db)
  }

  async applyCorrection(input: unknown): Promise<FinancialCorrectionResult> {
    const values = financialCorrectionSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const resident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(
      context,
      resident.organization_id,
      resident.hostel_id
    )

    const { data, error } = await (
      this.adminDb as unknown as FinancialCorrectionRpcClient
    ).rpc("apply_resident_financial_correction_atomic", {
      p_organization_id: values.organizationId,
      p_resident_id: values.residentId,
      p_change_type: values.changeType,
      p_new_value: values.newValue,
      p_reason: values.reason,
      p_actor_user_id: context.authUser.id,
    })

    if (error) {
      if (error.message.includes("financial_correction_no_change")) {
        throw conflict("The new value matches the current value.")
      }

      if (error.code === "22023") {
        throw badRequest("The financial correction input is invalid.")
      }

      if (error.code === "P0002") {
        throw notFound("Resident not found.")
      }

      throwRepositoryError(error, "Unable to apply the financial correction.")
    }

    const result = financialCorrectionResultSchema.parse(data)

    await this.realtimeService.residentFinancialCorrected({
      organizationId: result.organizationId,
      hostelId: result.hostelId,
      residentId: result.residentId,
      actorUserId: context.authUser.id,
      changeType: result.changeType,
      auditLogId: result.auditLogId,
    })

    return result
  }
}
