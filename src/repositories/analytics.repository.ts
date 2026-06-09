import type { PostgrestError } from "@supabase/supabase-js"

import type { Tables } from "@/types/database"
import type { ResidentLifecycleRow } from "@/services/analytics/operational-metrics"

import { throwRepositoryError, type AppSupabaseClient } from "./types"

export type RecentPayment = Pick<
  Tables<"payments">,
  "id" | "resident_id" | "amount" | "method" | "status" | "created_at" | "verified_at"
>

export type RecentLeave = Pick<
  Tables<"leave_requests">,
  "id" | "resident_id" | "from_date" | "to_date" | "status" | "created_at"
>

export type OwnerRoom = Pick<
  Tables<"rooms">,
  "id" | "room_number" | "room_type" | "capacity" | "base_monthly_fee" | "status"
>

export type OwnerAllocation = Pick<
  Tables<"room_allocations">,
  "room_id" | "resident_id" | "allocated_from" | "allocated_to" | "status"
>

export type OwnerSupportRequest = Pick<
  Tables<"support_requests">,
  "id" | "category" | "priority" | "status" | "created_at" | "resolved_at"
>

export type OwnerNoticeNotification = Pick<
  Tables<"notifications">,
  "id" | "notice_id" | "status" | "created_at" | "delivered_at" | "read_at"
>

export type OwnerResident = ResidentLifecycleRow & {
  id: string
  created_at: string
  joined_on: string | null
  checkout_on: string | null
  status: string
  is_active: boolean | null
  user_id: string | null
  monthly_fee_amount: number
  onboarding_status: string | null
}

export type OwnerReservation = {
  id: string
  created_at: string
  reserved_until: string
  reserved_bed_count: number
  advance_amount: number
  status: string
}

export type OwnerFeeRecord = Pick<
  Tables<"monthly_fee_records">,
  "resident_id" | "period_month" | "due_date" | "total_amount" | "paid_amount" | "balance_amount" | "status"
>

export type ResidentGrowthRow = ResidentLifecycleRow & {
  id: string
  created_at: string
}

export type DashboardFeeRecord = Pick<
  Tables<"monthly_fee_records">,
  "resident_id" | "balance_amount" | "status"
>

export type ActiveRoomAllocation = Pick<
  Tables<"room_allocations">,
  "id" | "room_id" | "resident_id" | "allocated_from" | "allocated_to" | "status"
>

export type OwnerCapacity = {
  total_beds: number
  occupied_beds: number
  reserved_beds: number
  maintenance_blocked_beds: number
  available_beds: number
  last_calculated_at: string
}

type QueryResult<T> = {
  data: T | null
  error: PostgrestError | null
  count?: number | null
}

type GenericAnalyticsQueryBuilder = {
  select(columns?: string, options?: { count?: "exact"; head?: boolean }): GenericAnalyticsQueryBuilder
  eq(column: string, value: unknown): GenericAnalyticsQueryBuilder
  is(column: string, value: boolean | null): GenericAnalyticsQueryBuilder
  in(column: string, values: unknown[]): GenericAnalyticsQueryBuilder
  gte(column: string, value: unknown): GenericAnalyticsQueryBuilder
  lte(column: string, value: unknown): GenericAnalyticsQueryBuilder
  order(column: string, options?: { ascending?: boolean }): GenericAnalyticsQueryBuilder
  limit(count: number): GenericAnalyticsQueryBuilder
  maybeSingle(): Promise<QueryResult<unknown>>
  range(from: number, to: number): Promise<QueryResult<unknown[]>>
}

type GenericAnalyticsDb = {
  from(table: string): GenericAnalyticsQueryBuilder
}

export class AnalyticsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async countActiveResidents(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("residents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { count, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to count residents.")
    }

    return count ?? 0
  }

  async listResidentLifecycleRows(organizationId: string, hostelId?: string) {
    let query = this.analyticsDb()
      .from("residents")
      .select("id,status,is_active,user_id,checkout_on,onboarding_status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load resident lifecycle metrics.")
    }

    return (data ?? []) as unknown as ResidentLifecycleRow[]
  }

  async getRoomCapacity(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("rooms")
      .select("capacity")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load room capacity.")
    }

    return (data ?? []).reduce((sum, room) => sum + room.capacity, 0)
  }

  async countActiveRoomAllocations(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("room_allocations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { count, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to count room allocations.")
    }

    return count ?? 0
  }

  async listActiveRoomAllocationsForOccupancy(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("room_allocations")
      .select("id,room_id,resident_id,allocated_from,allocated_to,status")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load room allocations.")
    }

    return (data ?? []) as ActiveRoomAllocation[]
  }

  async getVerifiedRevenue(organizationId: string, fromDate: string, toDate: string, hostelId?: string) {
    let query = this.db
      .from("payments")
      .select("amount")
      .eq("organization_id", organizationId)
      .eq("status", "verified")
      .gte("verified_at", fromDate)
      .lte("verified_at", toDate)
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load verified revenue.")
    }

    return (data ?? []).reduce((sum, payment) => sum + payment.amount, 0)
  }

  async getPendingDues(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("monthly_fee_records")
      .select("balance_amount")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "partial", "overdue"])
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load pending dues.")
    }

    return (data ?? []).reduce((sum, feeRecord) => sum + feeRecord.balance_amount, 0)
  }

  async listPendingDuesRecords(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("monthly_fee_records")
      .select("resident_id,balance_amount,status")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "partial", "overdue"])
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load pending dues.")
    }

    return (data ?? []) as DashboardFeeRecord[]
  }

  async countPendingPaymentRequests(organizationId: string, hostelId?: string) {
    let query = this.analyticsDb()
      .from("payments")
      .select("id", { count: "exact" })
      .eq("organization_id", organizationId)
      .in("status", ["initiated", "pending"])
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { count, error } = await query.range(0, 0)

    if (error) {
      throwRepositoryError(error, "Unable to count pending payment requests.")
    }

    return count ?? 0
  }

  async countActiveLeaves(organizationId: string, date: string, hostelId?: string) {
    let query = this.analyticsDb()
      .from("leave_requests")
      .select("id", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("status", "approved")
      .lte("from_date", date)
      .gte("to_date", date)
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { count, error } = await query.range(0, 0)

    if (error) {
      throwRepositoryError(error, "Unable to count active leaves.")
    }

    return count ?? 0
  }

  async countNewAdmissionLeads(organizationId: string, hostelId?: string) {
    let query = this.analyticsDb()
      .from("leads")
      .select("id", { count: "exact" })
      .eq("organization_id", organizationId)
      .in("status", ["new_inquiry", "called", "interested"])
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { count, error } = await query.range(0, 0)

    if (error) {
      throwRepositoryError(error, "Unable to count new admission inquiries.")
    }

    return count ?? 0
  }

  async countPendingInvites(organizationId: string, now: string, hostelId?: string) {
    let query = this.analyticsDb()
      .from("resident_invites")
      .select("resident_id")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .gte("expires_at", now)
      .is("used_at", null)
      .is("revoked_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to count pending resident invites.")
    }

    return new Set(
      (data ?? [])
        .map((invite) =>
          typeof invite === "object" &&
          invite !== null &&
          "resident_id" in invite
            ? invite.resident_id
            : null
        )
        .filter((residentId): residentId is string => typeof residentId === "string")
    ).size
  }

  async listRecentPayments(organizationId: string, hostelId?: string, limit = 5) {
    let query = this.db
      .from("payments")
      .select("id,resident_id,amount,method,status,created_at,verified_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load recent payments.")
    }

    return (data ?? []) as RecentPayment[]
  }

  async listRecentLeaves(organizationId: string, hostelId?: string, limit = 5) {
    let query = this.db
      .from("leave_requests")
      .select("id,resident_id,from_date,to_date,status,created_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load recent leave requests.")
    }

    return (data ?? []) as RecentLeave[]
  }

  async listPaymentsInRange(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.db
      .from("payments")
      .select("amount,status,method,created_at,verified_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .or(
        [
          `and(created_at.gte.${fromDate},created_at.lte.${toDate})`,
          `and(verified_at.gte.${fromDate},verified_at.lte.${toDate})`,
        ].join(",")
      )

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load payment trends.")
    }

    return data ?? []
  }

  async listFeeRecordsInRange(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.db
      .from("monthly_fee_records")
      .select("resident_id,period_month,total_amount,paid_amount,balance_amount,status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("period_month", fromDate)
      .lte("period_month", toDate)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load fee trends.")
    }

    return data ?? []
  }

  async listRoomAllocationsInRange(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.db
      .from("room_allocations")
      .select("resident_id,allocated_from,allocated_to,status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .lte("allocated_from", toDate)
      .or(`allocated_to.is.null,allocated_to.gte.${fromDate}`)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load occupancy trends.")
    }

    return data ?? []
  }

  async listLeavesInRange(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.db
      .from("leave_requests")
      .select("created_at,status,resident_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load leave analytics.")
    }

    return data ?? []
  }

  async listResidentsCreatedInRange(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.analyticsDb()
      .from("residents")
      .select("id,created_at,status,is_active,user_id,checkout_on,onboarding_status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load resident growth analytics.")
    }

    return (data ?? []) as unknown as ResidentGrowthRow[]
  }

  async getHostelCapacitySnapshot(organizationId: string, hostelId?: string) {
    let query = this.analyticsDb()
      .from("hostel_capacity")
      .select(
        "total_beds,occupied_beds,reserved_beds,maintenance_blocked_beds,available_beds,last_calculated_at"
      )
      .eq("organization_id", organizationId)
      .order("last_calculated_at", { ascending: false })
      .limit(1)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load capacity snapshot.")
    }

    return data as unknown as OwnerCapacity | null
  }

  async listOwnerRooms(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("rooms")
      .select("id,room_number,room_type,capacity,base_monthly_fee,status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("room_number", { ascending: true })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load owner room analytics.")
    }

    return (data ?? []) as OwnerRoom[]
  }

  async listOwnerAllocations(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("room_allocations")
      .select("room_id,resident_id,allocated_from,allocated_to,status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load owner allocation analytics.")
    }

    return (data ?? []) as OwnerAllocation[]
  }

  async listOwnerResidents(organizationId: string, hostelId?: string) {
    let query = this.analyticsDb()
      .from("residents")
      .select("id,created_at,joined_on,checkout_on,status,is_active,user_id,monthly_fee_amount,onboarding_status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load owner resident analytics.")
    }

    return (data ?? []) as unknown as OwnerResident[]
  }

  async listOwnerReservations(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.analyticsDb()
      .from("reservations")
      .select("id,created_at,reserved_until,reserved_bed_count,advance_amount,status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .order("created_at", { ascending: true })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load reservation analytics.")
    }

    return (data ?? []) as unknown as OwnerReservation[]
  }

  async listOwnerFeeRecords(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.db
      .from("monthly_fee_records")
      .select("resident_id,period_month,due_date,total_amount,paid_amount,balance_amount,status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("period_month", fromDate)
      .lte("period_month", toDate)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load owner fee analytics.")
    }

    return (data ?? []) as OwnerFeeRecord[]
  }

  async listOwnerSupportRequests(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.db
      .from("support_requests")
      .select("id,category,priority,status,created_at,resolved_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load owner complaint analytics.")
    }

    return (data ?? []) as OwnerSupportRequest[]
  }

  async listOwnerNoticeNotifications(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    let query = this.db
      .from("notifications")
      .select("id,notice_id,status,created_at,delivered_at,read_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load owner notice engagement.")
    }

    return (data ?? []).filter(
      (notification) => notification.notice_id
    ) as OwnerNoticeNotification[]
  }

  private analyticsDb() {
    return this.db as unknown as GenericAnalyticsDb
  }
}
