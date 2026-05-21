import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict } from "@/lib/api/api-error"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { RoomsRepository } from "@/repositories/rooms.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  allocateRoomSchema,
  createRoomSchema,
  roomListSchema,
  updateRoomSchema,
} from "@/validations/room.validation"

import { assertFound, AuthService } from "./auth.service"

export class RoomsService {
  private readonly authService: AuthService
  private readonly roomsRepository: RoomsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.roomsRepository = new RoomsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new RoomsService(db)
  }

  async listRooms(input: unknown) {
    const values = roomListSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.roomsRepository.list(values)
  }

  async createRoom(input: unknown) {
    const values = createRoomSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.roomsRepository.create({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      room_number: values.roomNumber,
      room_name: values.roomName,
      room_type: values.roomType,
      floor: values.floor,
      block_name: values.blockName,
      capacity: values.capacity,
      base_monthly_fee: values.baseMonthlyFee,
      has_attached_bathroom: values.hasAttachedBathroom,
      has_ac: values.hasAc,
      description: values.description,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }

  async getRoom(roomId: string, organizationId: string) {
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, organizationId)

    const [room, occupancy, allocations] = await Promise.all([
      this.roomsRepository.getById(roomId, organizationId),
      this.roomsRepository.getOccupancy(roomId, organizationId),
      this.roomsRepository.listAllocations(roomId, organizationId),
    ])

    return {
      room: assertFound(room, "Room not found."),
      occupancy,
      allocations,
    }
  }

  async updateRoom(input: unknown) {
    const values = updateRoomSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.roomsRepository.update(values.roomId, values.organizationId, {
      room_name: values.roomName,
      room_type: values.roomType,
      floor: values.floor,
      block_name: values.blockName,
      capacity: values.capacity,
      base_monthly_fee: values.baseMonthlyFee,
      has_attached_bathroom: values.hasAttachedBathroom,
      has_ac: values.hasAc,
      status: values.status,
      description: values.description,
      updated_by: context.authUser.id,
    })
  }

  async allocateRoom(input: unknown) {
    const values = allocateRoomSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    try {
      return await this.roomsRepository.allocateRoomAtomic({
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        roomId: values.roomId,
        residentId: values.residentId,
        bedLabel: values.bedLabel,
        allocatedFrom: values.allocatedFrom,
        allocatedTo: values.allocatedTo,
        monthlyFeeAmount: values.monthlyFeeAmount,
        reason: values.reason,
        actorUserId: context.authUser.id,
      })
    } catch (error) {
      throw mapRoomAllocationError(error)
    }
  }
}

function mapRoomAllocationError(error: unknown): never {
  const message = error instanceof Error ? error.message : ""

  if (message.includes("room_capacity_exceeded")) {
    throw conflict("Room is already at full capacity.")
  }

  if (message.includes("resident_already_allocated")) {
    throw conflict("Resident already has an active room allocation.")
  }

  if (message.includes("room_not_allocatable")) {
    throw conflict("Room is not available for allocation.")
  }

  if (message.includes("resident_not_allocatable")) {
    throw conflict("Resident is not eligible for room allocation.")
  }

  if (message.includes("room_not_found")) {
    throw conflict("Room not found.")
  }

  if (message.includes("resident_not_found")) {
    throw conflict("Resident not found.")
  }

  throw error
}
