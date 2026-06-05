import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"

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

export type ListNotificationsFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  recipientUserId?: string
  status?: NotificationStatus
  channel?: NotificationChannel
  unreadOnly?: boolean
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
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to mark notification read.")
    }

    return data
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

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query.select("id")

    if (error) {
      throwRepositoryError(error, "Unable to mark notifications read.")
    }

    return data?.length ?? 0
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
}
