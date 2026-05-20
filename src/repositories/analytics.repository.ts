import type { Tables } from "@/types/database"

import { throwRepositoryError, type AppSupabaseClient } from "./types"

export type RecentPayment = Pick<
  Tables<"payments">,
  "id" | "resident_id" | "amount" | "method" | "status" | "created_at" | "verified_at"
>

export type RecentLeave = Pick<
  Tables<"leave_requests">,
  "id" | "resident_id" | "from_date" | "to_date" | "status" | "created_at"
>

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

  async getVerifiedRevenue(organizationId: string, fromDate: string, toDate: string, hostelId?: string) {
    let query = this.db
      .from("payments")
      .select("amount")
      .eq("organization_id", organizationId)
      .eq("status", "verified")
      .gte("verified_at", fromDate)
      .lt("verified_at", toDate)
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
}
