import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/repositories/types"
import { throwRepositoryError } from "@/repositories/types"
import {
  reportRequestSchema,
  reportTypeSchema,
  type ReportRequestInput,
  type ReportType,
} from "@/validations/report.validation"

import { AuthService } from "../auth.service"
import type { ReportColumn, ReportDefinition, ReportRow } from "./types"

const PAGE_SIZE = 500

const REPORT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  payments: [
    { key: "created_at", label: "Created At" },
    { key: "resident_id", label: "Resident ID" },
    { key: "amount", label: "Amount" },
    { key: "method", label: "Method" },
    { key: "status", label: "Status" },
    { key: "transaction_id", label: "Transaction ID" },
    { key: "verified_at", label: "Verified At" },
  ],
  residents: [
    { key: "admission_number", label: "Admission Number" },
    { key: "full_name", label: "Full Name" },
    { key: "resident_type", label: "Resident Type" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "monthly_fee_amount", label: "Monthly Fee" },
    { key: "joined_on", label: "Joined On" },
  ],
  occupancy: [
    { key: "room_number", label: "Room Number" },
    { key: "room_type", label: "Room Type" },
    { key: "capacity", label: "Capacity" },
    { key: "occupied", label: "Occupied" },
    { key: "vacant", label: "Vacant" },
    { key: "status", label: "Status" },
  ],
  leaves: [
    { key: "created_at", label: "Created At" },
    { key: "resident_id", label: "Resident ID" },
    { key: "from_date", label: "From" },
    { key: "to_date", label: "To" },
    { key: "status", label: "Status" },
    { key: "travel_mode", label: "Travel Mode" },
    { key: "destination", label: "Destination" },
  ],
}

export class ReportBuilderService {
  private readonly authService: AuthService

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new ReportBuilderService(db)
  }

  async build(typeInput: unknown, input: unknown): Promise<ReportDefinition> {
    const type = reportTypeSchema.parse(typeInput)
    const values = reportRequestSchema.parse(input)
    const context = await this.authService.requirePermission("reports.export")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const scopedValues = {
      ...values,
      ...(hostelId ? { hostelId } : {}),
    }

    return {
      fileName: this.fileName(type, scopedValues),
      columns: REPORT_COLUMNS[type],
      rows: this.rowsFor(type, scopedValues),
    }
  }

  private rowsFor(type: ReportType, values: ReportRequestInput): AsyncIterable<ReportRow> {
    switch (type) {
      case "payments":
        return this.paymentRows(values)
      case "residents":
        return this.residentRows(values)
      case "occupancy":
        return this.occupancyRows(values)
      case "leaves":
        return this.leaveRows(values)
    }
  }

  private async *paymentRows(values: ReportRequestInput): AsyncIterable<ReportRow> {
    let emitted = 0

    while (emitted < values.maxRows) {
      let query = this.db
        .from("payments")
        .select("created_at,resident_id,amount,method,status,transaction_id,verified_at")
        .eq("organization_id", values.organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(emitted, Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1))

      if (values.hostelId) query = query.eq("hostel_id", values.hostelId)
      if (values.fromDate) query = query.gte("created_at", values.fromDate)
      if (values.toDate) query = query.lte("created_at", values.toDate)

      const { data, error } = await query
      if (error) throwRepositoryError(error, "Unable to export payment report.")
      if (!data?.length) break

      for (const row of data) {
        emitted += 1
        yield row
      }
    }
  }

  private async *residentRows(values: ReportRequestInput): AsyncIterable<ReportRow> {
    let emitted = 0

    while (emitted < values.maxRows) {
      let query = this.db
        .from("residents")
        .select("admission_number,full_name,resident_type,phone,email,status,monthly_fee_amount,joined_on")
        .eq("organization_id", values.organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(emitted, Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1))

      if (values.hostelId) query = query.eq("hostel_id", values.hostelId)
      if (values.fromDate) query = query.gte("created_at", values.fromDate)
      if (values.toDate) query = query.lte("created_at", values.toDate)

      const { data, error } = await query
      if (error) throwRepositoryError(error, "Unable to export resident report.")
      if (!data?.length) break

      for (const row of data) {
        emitted += 1
        yield row
      }
    }
  }

  private async *leaveRows(values: ReportRequestInput): AsyncIterable<ReportRow> {
    let emitted = 0

    while (emitted < values.maxRows) {
      let query = this.db
        .from("leave_requests")
        .select("created_at,resident_id,from_date,to_date,status,travel_mode,destination")
        .eq("organization_id", values.organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(emitted, Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1))

      if (values.hostelId) query = query.eq("hostel_id", values.hostelId)
      if (values.fromDate) query = query.gte("created_at", values.fromDate)
      if (values.toDate) query = query.lte("created_at", values.toDate)

      const { data, error } = await query
      if (error) throwRepositoryError(error, "Unable to export leave report.")
      if (!data?.length) break

      for (const row of data) {
        emitted += 1
        yield row
      }
    }
  }

  private async *occupancyRows(values: ReportRequestInput): AsyncIterable<ReportRow> {
    let emitted = 0

    while (emitted < values.maxRows) {
      let roomQuery = this.db
        .from("rooms")
        .select("id,room_number,room_type,capacity,status")
        .eq("organization_id", values.organizationId)
        .is("deleted_at", null)
        .order("room_number", { ascending: true })
        .range(emitted, Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1))

      if (values.hostelId) roomQuery = roomQuery.eq("hostel_id", values.hostelId)

      const { data: rooms, error } = await roomQuery
      if (error) throwRepositoryError(error, "Unable to export occupancy report.")
      if (!rooms?.length) break

      const roomIds = rooms.map((room) => room.id)
      const { data: allocations, error: allocationError } = await this.db
        .from("room_allocations")
        .select("room_id")
        .eq("organization_id", values.organizationId)
        .eq("status", "active")
        .in("room_id", roomIds)
        .is("deleted_at", null)

      if (allocationError) {
        throwRepositoryError(allocationError, "Unable to load occupancy allocations.")
      }

      const occupiedByRoom = new Map<string, number>()
      for (const allocation of allocations ?? []) {
        occupiedByRoom.set(
          allocation.room_id,
          (occupiedByRoom.get(allocation.room_id) ?? 0) + 1
        )
      }

      for (const room of rooms) {
        const occupied = occupiedByRoom.get(room.id) ?? 0
        emitted += 1
        yield {
          room_number: room.room_number,
          room_type: room.room_type,
          capacity: room.capacity,
          occupied,
          vacant: Math.max(0, room.capacity - occupied),
          status: room.status,
        }
      }
    }
  }

  private fileName(type: ReportType, values: ReportRequestInput) {
    const date = new Date().toISOString().slice(0, 10)
    const hostelScope = values.hostelId ? `-${values.hostelId.slice(0, 8)}` : ""

    return `${type}${hostelScope}-${date}`
  }
}
