import type { PostgrestError } from "@supabase/supabase-js"

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

  async getActiveAllocationForResidentInHostel(
    residentId: string,
    organizationId: string,
    hostelId: string
  ) {
    const { data, error } = await this.db
      .from("room_allocations")
      .select("*")
      .eq("resident_id", residentId)
      .eq("organization_id", organizationId)
      .eq("hostel_id", hostelId)
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

  async allocateRoomAtomic(values: {
    organizationId: string
    hostelId: string
    roomId: string
    residentId: string
    bedLabel?: string
    allocatedFrom: string
    allocatedTo?: string
    monthlyFeeAmount?: number
    reason?: string
    actorUserId: string
  }) {
    const rpc = this.db as unknown as AllocateRoomAtomicRpcClient
    const { data, error } = await rpc.rpc("allocate_room_atomic", {
      p_organization_id: values.organizationId,
      p_hostel_id: values.hostelId,
      p_room_id: values.roomId,
      p_resident_id: values.residentId,
      p_bed_label: normalizeOptionalText(values.bedLabel),
      p_allocated_from: values.allocatedFrom,
      p_allocated_to: values.allocatedTo ?? null,
      p_monthly_fee_amount: values.monthlyFeeAmount ?? null,
      p_reason: values.reason ?? null,
      p_actor_user_id: values.actorUserId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to allocate room.")
    }

    if (!data) {
      throwRepositoryError(null, "Unable to allocate room.")
    }

    return data
  }

  async transferRoomAtomic(values: {
    organizationId: string
    hostelId: string
    residentId: string
    fromRoomId?: string
    toRoomId: string
    bedLabel?: string
    transferDate: string
    monthlyFeeAmount?: number
    reason?: string
    actorUserId: string
  }) {
    const rpc = this.db as unknown as TransferRoomAtomicRpcClient
    const { data, error } = await rpc.rpc("transfer_room_atomic", {
      p_organization_id: values.organizationId,
      p_hostel_id: values.hostelId,
      p_resident_id: values.residentId,
      p_from_room_id: values.fromRoomId ?? null,
      p_to_room_id: values.toRoomId,
      p_bed_label: normalizeOptionalText(values.bedLabel),
      p_transfer_date: values.transferDate,
      p_monthly_fee_amount: values.monthlyFeeAmount ?? null,
      p_reason: values.reason ?? null,
      p_actor_user_id: values.actorUserId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to transfer resident room.")
    }

    if (!data) {
      throwRepositoryError(null, "Unable to transfer resident room.")
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

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim()

  return normalized || null
}

type AllocateRoomAtomicRpcClient = {
  rpc(
    fn: "allocate_room_atomic",
    args: {
      p_organization_id: string
      p_hostel_id: string
      p_room_id: string
      p_resident_id: string
      p_bed_label: string | null
      p_allocated_from: string
      p_allocated_to: string | null
      p_monthly_fee_amount: number | null
      p_reason: string | null
      p_actor_user_id: string
    }
  ): Promise<{ data: RoomAllocationRow | null; error: PostgrestError | null }>
}

type TransferRoomAtomicRpcClient = {
  rpc(
    fn: "transfer_room_atomic",
    args: {
      p_organization_id: string
      p_hostel_id: string
      p_resident_id: string
      p_from_room_id: string | null
      p_to_room_id: string
      p_bed_label: string | null
      p_transfer_date: string
      p_monthly_fee_amount: number | null
      p_reason: string | null
      p_actor_user_id: string
    }
  ): Promise<{ data: RoomAllocationRow | null; error: PostgrestError | null }>
}
