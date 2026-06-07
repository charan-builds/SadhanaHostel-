import "server-only"

import { anyRoleHasPermission } from "@/constants/auth"
import { badRequest, forbidden, notFound } from "@/lib/api/api-error"
import { noticeTargetsResident } from "@/lib/notices/audience"
import { noticeNotificationClassification } from "@/lib/notices/notification-classification"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NoticeAcknowledgementsRepository } from "@/repositories/notice-acknowledgements.repository"
import { NoticeReadsRepository } from "@/repositories/notice-reads.repository"
import { NoticesRepository, type NoticeRow } from "@/repositories/notices.repository"
import {
  NotificationsRepository,
  type NoticeRecipientStats,
} from "@/repositories/notifications.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient, PaginatedResult } from "@/repositories/types"
import type { Json } from "@/types/database"
import type { NoticeWithEngagement } from "@/types/notices"
import {
  acknowledgeNoticeSchema,
  createNoticeSchema,
  markNoticeReadSchema,
  noticeListSchema,
  updateNoticeSchema,
} from "@/validations/notice.validation"

import { AuthService } from "./auth.service"
import { NotificationService } from "./notifications"

export class NoticesService {
  private readonly authService: AuthService
  private readonly noticesRepository: NoticesRepository
  private readonly notificationsRepository: NotificationsRepository
  private readonly noticeAcknowledgementsRepository: NoticeAcknowledgementsRepository
  private readonly noticeReadsRepository: NoticeReadsRepository
  private readonly adminNotificationsRepository: NotificationsRepository
  private readonly adminNoticeAcknowledgementsRepository: NoticeAcknowledgementsRepository
  private readonly adminNoticeReadsRepository: NoticeReadsRepository
  private readonly notificationService: NotificationService
  private readonly residentsRepository: ResidentsRepository

  constructor(
    private readonly db: AppSupabaseClient,
    adminDb: AppSupabaseClient = db
  ) {
    this.authService = new AuthService(db)
    this.noticesRepository = new NoticesRepository(db)
    this.notificationsRepository = new NotificationsRepository(db)
    this.noticeAcknowledgementsRepository = new NoticeAcknowledgementsRepository(db)
    this.noticeReadsRepository = new NoticeReadsRepository(db)
    this.adminNotificationsRepository = new NotificationsRepository(adminDb)
    this.adminNoticeAcknowledgementsRepository =
      new NoticeAcknowledgementsRepository(adminDb)
    this.adminNoticeReadsRepository = new NoticeReadsRepository(adminDb)
    this.notificationService = new NotificationService(db, adminDb)
    this.residentsRepository = new ResidentsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new NoticesService(db, createSupabaseAdminClient())
  }

  async listNotices(input: unknown) {
    const values = noticeListSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const isAdmin = anyRoleHasPermission(context.roles, "notices.manage")
    const resident = isAdmin
      ? null
      : await this.residentsRepository.getByUserId(
          context.authUser.id,
          values.organizationId
        )

    if (!isAdmin && !resident) {
      throw forbidden("Resident profile is required to view notices.")
    }

    const hostelId = isAdmin
      ? this.authService.resolveHostelScope(context, values.organizationId, values.hostelId)
      : resident?.hostel_id

    const notices = await this.noticesRepository.list({
      ...values,
      ...(hostelId ? { hostelId } : {}),
      status: isAdmin ? values.status : "published",
      activeOnly: isAdmin ? values.activeOnly : true,
    })

    return this.withNoticeEngagement(notices, {
      organizationId: values.organizationId,
      hostelId: hostelId ?? undefined,
      residentId: resident?.id,
      recipientUserId: isAdmin ? undefined : context.authUser.id,
      includeRecipientStats: isAdmin,
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
      notice_type: values.noticeType,
      requires_acknowledgement: values.requiresAcknowledgement,
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

  async acknowledgeNotice(noticeId: string, input: unknown) {
    const values = acknowledgeNoticeSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = await this.residentsRepository.getByUserId(
      context.authUser.id,
      values.organizationId
    )

    if (!resident) {
      throw forbidden("Resident profile is required to acknowledge notices.")
    }

    const notice = await this.noticesRepository.getById(noticeId, values.organizationId)

    if (!notice) {
      throw notFound("Notice not found.")
    }

    if (!notice.requires_acknowledgement) {
      throw badRequest("Notice does not require acknowledgement.")
    }

    await this.adminNotificationsRepository.markNoticeRead({
      noticeId: notice.id,
      organizationId: notice.organization_id,
      recipientUserId: context.authUser.id,
      actorUserId: context.authUser.id,
    })

    await this.adminNoticeReadsRepository.upsertRead({
      organization_id: notice.organization_id,
      hostel_id: resident.hostel_id,
      notice_id: notice.id,
      resident_id: resident.id,
      user_id: context.authUser.id,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    await this.adminNoticeAcknowledgementsRepository.upsertAcknowledgement({
      organization_id: notice.organization_id,
      hostel_id: resident.hostel_id,
      notice_id: notice.id,
      resident_id: resident.id,
      user_id: context.authUser.id,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    return {
      ...notice,
      total_recipients: 0,
      read_count: 1,
      unread_count: 0,
      read_percentage: 100,
      acknowledgement_count: 1,
      pending_count: 0,
      acknowledgement_percentage: 100,
      is_read: true,
      is_acknowledged: true,
      notification_id: null,
    } satisfies NoticeWithEngagement
  }

  async markNoticeRead(noticeId: string, input: unknown) {
    const values = markNoticeReadSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = await this.residentsRepository.getByUserId(
      context.authUser.id,
      values.organizationId
    )

    if (!resident) {
      throw forbidden("Resident profile is required to mark notices read.")
    }

    const notice = await this.noticesRepository.getById(noticeId, values.organizationId)

    if (!notice) {
      throw notFound("Notice not found.")
    }

    await this.adminNotificationsRepository.markNoticeRead({
      noticeId: notice.id,
      organizationId: notice.organization_id,
      recipientUserId: context.authUser.id,
      actorUserId: context.authUser.id,
    })

    await this.adminNoticeReadsRepository.upsertRead({
      organization_id: notice.organization_id,
      hostel_id: resident.hostel_id,
      notice_id: notice.id,
      resident_id: resident.id,
      user_id: context.authUser.id,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    return {
      ...notice,
      total_recipients: 0,
      read_count: 1,
      unread_count: 0,
      read_percentage: 100,
      acknowledgement_count: 0,
      pending_count: notice.requires_acknowledgement ? 1 : 0,
      acknowledgement_percentage: notice.requires_acknowledgement ? 0 : 100,
      is_read: true,
      is_acknowledged: false,
      notification_id: null,
    } satisfies NoticeWithEngagement
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
      notice_type: values.noticeType,
      requires_acknowledgement: values.requiresAcknowledgement,
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
      if (!noticeTargetsResident(notice, resident)) {
        continue
      }

      const existing = await this.notificationsRepository.findByNoticeRecipient({
        organizationId: notice.organization_id,
        noticeId: notice.id,
        residentId: resident.id,
        recipientUserId: resident.user_id,
      })

      if (existing) {
        continue
      }

      const classification = noticeNotificationClassification(notice)
      const message = {
        title: notice.title,
        body: notice.body,
        templateKey: classification.templateKey,
        payload: {
          notice_id: notice.id,
          notice_type: notice.notice_type,
          audience_type: notice.audience_type,
          requires_acknowledgement: notice.requires_acknowledgement,
        },
        category: classification.category,
        priority: classification.priority,
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

  private async withNoticeEngagement(
    notices: PaginatedResult<NoticeRow>,
    input: {
      organizationId: string
      hostelId?: string
      residentId?: string
      recipientUserId?: string
      includeRecipientStats: boolean
    }
  ): Promise<PaginatedResult<NoticeWithEngagement>> {
    const noticeIds = notices.data.map((notice) => notice.id)
    const [
      recipientStats,
      noticeReadCounts,
      noticeAcknowledgementCounts,
      residentReadIds,
      residentAcknowledgementIds,
      residentNotifications,
    ] = await Promise.all([
        input.includeRecipientStats
          ? this.notificationsRepository.listNoticeRecipientStats({
              organizationId: input.organizationId,
              hostelId: input.hostelId,
              noticeIds,
            })
          : Promise.resolve(new Map<string, NoticeRecipientStats>()),
        input.includeRecipientStats
          ? this.noticeReadsRepository.listReadCountsByNotice({
              organizationId: input.organizationId,
              hostelId: input.hostelId,
              noticeIds,
            })
          : Promise.resolve(new Map<string, number>()),
        input.includeRecipientStats
          ? this.noticeAcknowledgementsRepository.listAcknowledgementCountsByNotice({
              organizationId: input.organizationId,
              hostelId: input.hostelId,
              noticeIds,
            })
          : Promise.resolve(new Map<string, number>()),
        input.residentId
          ? this.noticeReadsRepository.listReadNoticeIdsForResident({
              organizationId: input.organizationId,
              residentId: input.residentId,
              noticeIds,
            })
          : Promise.resolve(new Set<string>()),
        input.residentId
          ? this.noticeAcknowledgementsRepository.listAcknowledgedNoticeIdsForResident({
              organizationId: input.organizationId,
              residentId: input.residentId,
              noticeIds,
            })
          : Promise.resolve(new Set<string>()),
        input.recipientUserId
          ? this.notificationsRepository.listNoticeNotificationsForRecipient({
              organizationId: input.organizationId,
              recipientUserId: input.recipientUserId,
              noticeIds,
            })
          : Promise.resolve([]),
      ])
    const notificationByNoticeId = new Map(
      residentNotifications
        .filter((notification) => notification.notice_id)
        .map((notification) => [notification.notice_id as string, notification])
    )

    return {
      ...notices,
      data: notices.data.map((notice) => {
        const stats = recipientStats.get(notice.id)
        const readCount = Math.max(
          stats?.readCount ?? 0,
          noticeReadCounts.get(notice.id) ?? 0
        )
        const totalRecipients = stats?.totalRecipients ?? 0
        const residentNotification = notificationByNoticeId.get(notice.id)
        const isRead = Boolean(
          residentReadIds.has(notice.id) || residentNotification?.read_at
        )
        const isAcknowledged = residentAcknowledgementIds.has(notice.id)
        const effectiveReadCount = input.includeRecipientStats ? readCount : isRead ? 1 : 0
        const unreadCount = Math.max(totalRecipients - effectiveReadCount, 0)
        const acknowledgementCount = input.includeRecipientStats
          ? noticeAcknowledgementCounts.get(notice.id) ?? 0
          : isAcknowledged
            ? 1
            : 0
        const pendingCount = notice.requires_acknowledgement
          ? Math.max(totalRecipients - acknowledgementCount, 0)
          : 0

        return {
          ...notice,
          total_recipients: totalRecipients,
          read_count: effectiveReadCount,
          unread_count: unreadCount,
          read_percentage:
            totalRecipients === 0
              ? isRead
                ? 100
                : 0
              : Number(((effectiveReadCount / totalRecipients) * 100).toFixed(2)),
          acknowledgement_count: acknowledgementCount,
          pending_count: pendingCount,
          acknowledgement_percentage:
            !notice.requires_acknowledgement
              ? 100
              : totalRecipients === 0
                ? isAcknowledged
                  ? 100
                  : 0
                : Number(((acknowledgementCount / totalRecipients) * 100).toFixed(2)),
          is_read: input.residentId ? isRead : undefined,
          is_acknowledged: input.residentId ? isAcknowledged : undefined,
          notification_id: residentNotification?.id ?? null,
        }
      }),
    }
  }
}
