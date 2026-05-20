import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict } from "@/lib/api/api-error"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ResidentsRepository } from "@/repositories/residents.repository"
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
  private readonly residentsRepository: ResidentsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.roomsRepository = new RoomsRepository(db)
    this.residentsRepository = new ResidentsRepository(db)
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

    const [room, resident, activeResidentAllocation, roomAllocations] =
      await Promise.all([
        this.roomsRepository.getById(values.roomId, values.organizationId),
        this.residentsRepository.getById(values.residentId, values.organizationId),
        this.roomsRepository.getActiveAllocationForResident(
          values.residentId,
          values.organizationId
        ),
        this.roomsRepository.listActiveAllocations(values.roomId, values.organizationId),
      ])

    const existingRoom = assertFound(room, "Room not found.")
    const existingResident = assertFound(resident, "Resident not found.")

    if (
      existingRoom.hostel_id !== values.hostelId ||
      existingResident.hostel_id !== values.hostelId
    ) {
      throw conflict("Room and resident must belong to the same hostel.")
    }

    if (activeResidentAllocation) {
      throw conflict("Resident already has an active room allocation.")
    }

    if (roomAllocations.length >= existingRoom.capacity) {
      throw conflict("Room is already at full capacity.")
    }

    return this.roomsRepository.createAllocation({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      room_id: values.roomId,
      resident_id: values.residentId,
      bed_label: values.bedLabel,
      allocated_from: values.allocatedFrom,
      allocated_to: values.allocatedTo,
      monthly_fee_amount: values.monthlyFeeAmount || existingRoom.base_monthly_fee,
      reason: values.reason,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }
}
