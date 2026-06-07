import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"
import type {
  NotificationCategory,
  NotificationPriority,
} from "@/lib/notifications/catalog"

import {
  createPaginationMeta,
  normalizePagination,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type NotificationRow = Tables<"notifications">
export type NotificationLogRow = Tables<"notification_logs">
export type NotificationChannel = Database["public"]["Enums"]["notification_channel_enum"]
export type NotificationStatus = Database["public"]["Enums"]["notification_status_enum"]
export type NoticeRecipientStats = {
  totalRecipients: number
  readCount: number
  unreadCount: number
  readPercentage: number
}

export type ListNotificationsFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  recipientUserId?: string
  status?: NotificationStatus
  channel?: NotificationChannel
  category?: NotificationCategory
  priority?: NotificationPriority
  unreadOnly?: boolean
  includeArchived?: boolean
}

export class NotificationsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async create(values: TablesInsert<"notifications">) {
    const { data, error } = await this.db
      .from("notifications")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create notification.")
    }

    return data
  }

  async update(
    notificationId: string,
    organizationId: string,
    values: TablesUpdate<"notifications">
  ) {
    const { data, error } = await this.db
      .from("notifications")
      .update(values)
      .eq("id", notificationId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update notification.")
    }

    return data
  }

  async list(filters: ListNotificationsFilters): Promise<PaginatedResult<NotificationRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)

    let query = this.db
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (!filters.includeArchived) {
      query = query.is("archived_at", null)
    }

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.recipientUserId) {
      query = query.eq("recipient_user_id", filters.recipientUserId)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.channel) {
      query = query.eq("channel", filters.channel)
    }

    if (filters.category) {
      query = query.eq("category", filters.category)
    }

    if (filters.priority) {
      query = query.eq("priority", filters.priority)
    }

    if (filters.unreadOnly) {
      query = query.is("read_at", null)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list notifications.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async markRead(input: {
    notificationId: string
    organizationId: string
    recipientUserId: string
    actorUserId: string
  }) {
    const now = new Date().toISOString()
    const { data, error } = await this.db
      .from("notifications")
      .update({
        read_at: now,
        status: "read",
        updated_by: input.actorUserId,
      })
      .eq("id", input.notificationId)
      .eq("organization_id", input.organizationId)
      .eq("recipient_user_id", input.recipientUserId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to mark notification read.")
    }

    return data
  }

  async markNoticeRead(input: {
    noticeId: string
    organizationId: string
    recipientUserId: string
    actorUserId: string
  }) {
    const now = new Date().toISOString()
    const { data, error } = await this.db
      .from("notifications")
      .update({
        read_at: now,
        status: "read",
        updated_by: input.actorUserId,
      })
      .eq("notice_id", input.noticeId)
      .eq("organization_id", input.organizationId)
      .eq("recipient_user_id", input.recipientUserId)
      .eq("channel", "in_app")
      .is("deleted_at", null)
      .is("archived_at", null)
      .select("*")

    if (error) {
      throwRepositoryError(error, "Unable to mark notice notification read.")
    }

    return data ?? []
  }

  async markAllRead(input: {
    organizationId: string
    hostelId?: string
    recipientUserId: string
    actorUserId: string
  }) {
    const now = new Date().toISOString()
    let query = this.db
      .from("notifications")
      .update({
        read_at: now,
        status: "read",
        updated_by: input.actorUserId,
      })
      .eq("organization_id", input.organizationId)
      .eq("recipient_user_id", input.recipientUserId)
      .is("read_at", null)
      .is("deleted_at", null)
      .is("archived_at", null)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query.select("id")

    if (error) {
      throwRepositoryError(error, "Unable to mark notifications read.")
    }

    return data?.length ?? 0
  }

  async archive(input: {
    notificationId: string
    organizationId: string
    recipientUserId: string
    actorUserId: string
  }) {
    const now = new Date().toISOString()
    const { data, error } = await this.db
      .from("notifications")
      .update({
        archived_at: now,
        archived_by: input.actorUserId,
        is_active: false,
        updated_by: input.actorUserId,
      })
      .eq("id", input.notificationId)
      .eq("organization_id", input.organizationId)
      .eq("recipient_user_id", input.recipientUserId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to archive notification.")
    }

    return data
  }

  async listDueQueued(limit = 50) {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .in("status", ["queued", "failed"])
      .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) {
      throwRepositoryError(error, "Unable to list queued notifications.")
    }

    return data ?? []
  }

  async createLog(values: TablesInsert<"notification_logs">) {
    const { data, error } = await this.db
      .from("notification_logs")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create notification log.")
    }

    return data
  }

  async findByNoticeRecipient(input: {
    organizationId: string
    noticeId: string
    residentId?: string | null
    recipientUserId?: string | null
  }) {
    let query = this.db
      .from("notifications")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("notice_id", input.noticeId)
      .is("deleted_at", null)

    if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    } else {
      query = query.is("resident_id", null)
    }

    if (input.recipientUserId) {
      query = query.eq("recipient_user_id", input.recipientUserId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load notice notification.")
    }

    return data
  }

  async findByTemplateRecipientPayload(input: {
    organizationId: string
    templateKey: string
    residentId: string
    feeRecordId?: string
    reminderDate?: string
  }) {
    let query = this.db
      .from("notifications")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("template_key", input.templateKey)
      .eq("resident_id", input.residentId)
      .is("deleted_at", null)

    if (input.feeRecordId) {
      query = query.filter("payload->>fee_record_id", "eq", input.feeRecordId)
    }

    if (input.reminderDate) {
      query = query.filter("payload->>reminder_date", "eq", input.reminderDate)
    }

    const { data, error } = await query.limit(1).maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load existing notification.")
    }

    return data
  }

  async listNoticeNotificationsForRecipient(input: {
    organizationId: string
    recipientUserId: string
    noticeIds: string[]
  }) {
    if (input.noticeIds.length === 0) {
      return []
    }

    const { data, error } = await this.db
      .from("notifications")
      .select("id,notice_id,read_at")
      .eq("organization_id", input.organizationId)
      .eq("recipient_user_id", input.recipientUserId)
      .eq("channel", "in_app")
      .in("notice_id", input.noticeIds)
      .is("deleted_at", null)
      .is("archived_at", null)

    if (error) {
      throwRepositoryError(error, "Unable to load notice notifications.")
    }

    return data ?? []
  }

  async listNoticeRecipientStats(input: {
    organizationId: string
    hostelId?: string | null
    noticeIds: string[]
  }) {
    if (input.noticeIds.length === 0) {
      return new Map<string, NoticeRecipientStats>()
    }

    let query = this.db
      .from("notifications")
      .select("notice_id,read_at")
      .eq("organization_id", input.organizationId)
      .eq("channel", "in_app")
      .in("notice_id", input.noticeIds)
      .is("deleted_at", null)
      .is("archived_at", null)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load notice recipient stats.")
    }

    const stats = new Map<string, NoticeRecipientStats>()

    for (const row of data ?? []) {
      if (!row.notice_id) {
        continue
      }

      const current =
        stats.get(row.notice_id) ??
        {
          totalRecipients: 0,
          readCount: 0,
          unreadCount: 0,
          readPercentage: 0,
        }

      current.totalRecipients += 1
      current.readCount += row.read_at ? 1 : 0
      current.unreadCount = Math.max(current.totalRecipients - current.readCount, 0)
      current.readPercentage =
        current.totalRecipients === 0
          ? 0
          : Number(((current.readCount / current.totalRecipients) * 100).toFixed(2))
      stats.set(row.notice_id, current)
    }

    return stats
  }

  async getCommunicationAnalytics(input: {
    organizationId: string
    hostelId?: string | null
  }) {
    let query = this.db
      .from("notifications")
      .select("template_key,notice_id,read_at,status,resident_id")
      .eq("organization_id", input.organizationId)
      .eq("channel", "in_app")
      .is("deleted_at", null)
      .is("archived_at", null)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load communication analytics.")
    }

    const rows = data ?? []
    const adminNoticeRows = rows.filter((row) => row.notice_id)
    const feeReminderRows = rows.filter(
      (row) =>
        row.template_key === "payment_reminder" ||
        row.template_key === "payment_overdue"
    )
    const unreadNotices = adminNoticeRows.filter((row) => !row.read_at).length
    const unreadNotifications = rows.filter((row) => !row.read_at).length
    const unreadResidents = new Set(
      rows
        .filter((row) => !row.read_at && row.resident_id)
        .map((row) => row.resident_id as string)
    ).size
    const readNotices = adminNoticeRows.filter((row) => row.read_at).length
    const feeReminderReads = feeReminderRows.filter((row) => row.read_at).length

    return {
      unreadNotices,
      unreadNotifications,
      unreadResidents,
      totalNoticeRecipients: adminNoticeRows.length,
      readNoticeRecipients: readNotices,
      unreadNoticeRecipients: unreadNotices,
      noticeReadPercentage:
        adminNoticeRows.length === 0
          ? 0
          : Number(((readNotices / adminNoticeRows.length) * 100).toFixed(2)),
      feeReminderSent: feeReminderRows.length,
      feeReminderRead: feeReminderReads,
      feeReminderEngagement:
        feeReminderRows.length === 0
          ? 0
          : Number(((feeReminderReads / feeReminderRows.length) * 100).toFixed(2)),
    }
  }
}
