import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  auditCategorySchema,
  auditListSchema,
} from "@/validations/audit.validation"

import { AuthService } from "../auth.service"
import { AuditRepository } from "./audit.repository"

export class AuditService {
  private readonly authService: AuthService
  private readonly auditRepository: AuditRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.auditRepository = new AuditRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new AuditService(db)
  }

  async list(categoryInput: unknown, input: unknown) {
    const category = auditCategorySchema.parse(categoryInput)
    const values = auditListSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.auditRepository.list(category, values)
  }
}
