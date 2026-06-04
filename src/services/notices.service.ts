import "server-only"

import { anyRoleHasPermission } from "@/constants/auth"
import { notFound } from "@/lib/api/api-error"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NoticesRepository } from "@/repositories/notices.repository"
import { NotificationsRepository } from "@/repositories/notifications.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"
import {
  createNoticeSchema,
  noticeListSchema,
  updateNoticeSchema,
} from "@/validations/notice.validation"

import { AuthService } from "./auth.service"
import { NotificationService } from "./notifications"

export class NoticesService {
  private readonly authService: AuthService
  private readonly noticesRepository: NoticesRepository
  private readonly notificationsRepository: NotificationsRepository
  private readonly notificationService: NotificationService
  private readonly residentsRepository: ResidentsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.noticesRepository = new NoticesRepository(db)
    this.notificationsRepository = new NotificationsRepository(db)
    this.notificationService = new NotificationService(db)
    this.residentsRepository = new ResidentsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new NoticesService(db)
  }

  async listNotices(input: unknown) {
    const values = noticeListSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const isAdmin = anyRoleHasPermission(context.roles, "notices.manage")
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
    const context = await this.authService.requirePermission("notices.manage")
    const publishedAt = values.status === "published" ? new Date().toISOString() : null
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const notice = await this.noticesRepository.create({
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

    if (notice.status === "published") {
      await this.fanoutNoticeToResidents(notice, context.authUser.id)
    }

    return notice
  }

  async updateNotice(input: unknown) {
    const values = updateNoticeSchema.parse(input)
    const context = await this.authService.requirePermission("notices.manage")
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

    const notice = await this.noticesRepository.update(values.noticeId, values.organizationId, {
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

    if (notice.status === "published") {
      await this.fanoutNoticeToResidents(notice, context.authUser.id)
    }

    return notice
  }

  private async fanoutNoticeToResidents(
    notice: Awaited<ReturnType<NoticesRepository["create"]>>,
    actorUserId: string
  ) {
    const residents = await this.residentsRepository.listActiveForBilling(
      notice.organization_id,
      notice.hostel_id ?? undefined
    )

    for (const resident of residents) {
      const existing = await this.notificationsRepository.findByNoticeRecipient({
        organizationId: notice.organization_id,
        noticeId: notice.id,
        residentId: resident.id,
        recipientUserId: resident.user_id,
      })

      if (existing) {
        continue
      }

      const message = {
        title: notice.title,
        body: notice.body,
        templateKey: "notice_published",
        payload: {
          notice_id: notice.id,
          audience_type: notice.audience_type,
        },
      }

      await this.notificationService.queue({
        organizationId: notice.organization_id,
        hostelId: resident.hostel_id,
        channel: "in_app",
        noticeId: notice.id,
        recipient: {
          residentId: resident.id,
          userId: resident.user_id,
          email: resident.email,
          phone: resident.phone,
        },
        actorUserId,
        message,
      })

      if (resident.phone) {
        await this.notificationService.queue({
          organizationId: notice.organization_id,
          hostelId: resident.hostel_id,
          channel: "whatsapp",
          noticeId: notice.id,
          recipient: {
            residentId: resident.id,
            userId: resident.user_id,
            email: resident.email,
            phone: resident.phone,
          },
          actorUserId,
          message,
        })
      }
    }
  }
}
