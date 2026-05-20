import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"

import {
  createPaginationMeta,
  normalizePagination,
  sanitizeSearchTerm,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type RoomRow = Tables<"rooms">
export type RoomAllocationRow = Tables<"room_allocations">
export type RoomOccupancyRow = Tables<"room_occupancy_view">
export type RoomStatus = Database["public"]["Enums"]["room_status_enum"]

export type ListRoomsFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  status?: RoomStatus
  roomType?: string
  search?: string
}

export class RoomsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(filters: ListRoomsFilters): Promise<PaginatedResult<RoomRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)

    let query = this.db
      .from("rooms")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("room_number", { ascending: true })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.roomType) {
      query = query.eq("room_type", filters.roomType)
    }

    if (search) {
      query = query.or(
        `room_number.ilike.%${search}%,room_name.ilike.%${search}%,block_name.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list rooms.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getById(roomId: string, organizationId?: string) {
    let query = this.db
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .is("deleted_at", null)

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load room.")
    }

    return data
  }

  async getOccupancy(roomId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("room_occupancy_view")
      .select("*")
      .eq("room_id", roomId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load room occupancy.")
    }

    return data
  }

  async create(values: TablesInsert<"rooms">) {
    const { data, error } = await this.db
      .from("rooms")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create room.")
    }

    return data
  }

  async update(roomId: string, organizationId: string, values: TablesUpdate<"rooms">) {
    const { data, error } = await this.db
      .from("rooms")
      .update(values)
      .eq("id", roomId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update room.")
    }

    return data
  }

  async listActiveAllocations(roomId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("room_allocations")
      .select("*")
      .eq("room_id", roomId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("deleted_at", null)

    if (error) {
      throwRepositoryError(error, "Unable to load room allocations.")
    }

    return data ?? []
  }

  async getActiveAllocationForResident(residentId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("room_allocations")
      .select("*")
      .eq("resident_id", residentId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load resident room allocation.")
    }

    return data
  }

  async createAllocation(values: TablesInsert<"room_allocations">) {
    const { data, error } = await this.db
      .from("room_allocations")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to allocate room.")
    }

    return data
  }

  async listAllocations(roomId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("room_allocations")
      .select("*")
      .eq("room_id", roomId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("allocated_from", { ascending: false })

    if (error) {
      throwRepositoryError(error, "Unable to load room allocation history.")
    }

    return data ?? []
  }
}
