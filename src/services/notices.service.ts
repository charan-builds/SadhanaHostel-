import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { notFound } from "@/lib/api/api-error"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NoticesRepository } from "@/repositories/notices.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"
import {
  createNoticeSchema,
  noticeListSchema,
  updateNoticeSchema,
} from "@/validations/notice.validation"

import { AuthService } from "./auth.service"

export class NoticesService {
  private readonly authService: AuthService
  private readonly noticesRepository: NoticesRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.noticesRepository = new NoticesRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new NoticesService(db)
  }

  async listNotices(input: unknown) {
    const values = noticeListSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const isAdmin = context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role))
    const hostelId = isAdmin
      ? this.authService.resolveHostelScope(context, values.organizationId, values.hostelId)
      : values.hostelId

    return this.noticesRepository.list({
      ...values,
      ...(hostelId ? { hostelId } : {}),
      status: isAdmin ? values.status : "published",
      activeOnly: isAdmin ? values.activeOnly : true,
    })
  }

  async createNotice(input: unknown) {
    const values = createNoticeSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])
    const publishedAt = values.status === "published" ? new Date().toISOString() : null
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.noticesRepository.create({
      organization_id: values.organizationId,
      hostel_id: hostelId,
      title: values.title,
      body: values.body,
      status: values.status,
      audience_type: values.audienceType,
      audience_filter: values.audienceFilter as Json,
      is_pinned: values.isPinned,
      expires_at: values.expiresAt,
      published_at: publishedAt,
      published_by: publishedAt ? context.authUser.id : null,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }

  async updateNotice(input: unknown) {
    const values = updateNoticeSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])
    const publishedAt = values.status === "published" ? new Date().toISOString() : undefined
    const existingNotice = await this.noticesRepository.getById(
      values.noticeId,
      values.organizationId
    )

    if (!existingNotice) {
      throw notFound("Notice not found.")
    }

    this.authService.requireHostelAccess(
      context,
      existingNotice.organization_id,
      existingNotice.hostel_id
    )

    const hostelId =
      values.hostelId === undefined
        ? undefined
        : this.authService.resolveHostelScope(
            context,
            values.organizationId,
            values.hostelId
          )

    return this.noticesRepository.update(values.noticeId, values.organizationId, {
      hostel_id: hostelId,
      title: values.title,
      body: values.body,
      status: values.status,
      audience_type: values.audienceType,
      audience_filter: values.audienceFilter as Json | undefined,
      is_pinned: values.isPinned,
      is_active: values.isActive,
      expires_at: values.expiresAt,
      published_at: publishedAt,
      published_by: publishedAt ? context.authUser.id : undefined,
      updated_by: context.authUser.id,
    })
  }
}
