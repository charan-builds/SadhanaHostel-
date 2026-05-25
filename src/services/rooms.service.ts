import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict } from "@/lib/api/api-error"
import { logger } from "@/lib/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { RoomsRepository } from "@/repositories/rooms.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { RealtimeEventPublisher } from "@/services/realtime/event-publisher"
import {
  allocateRoomSchema,
  createRoomSchema,
  roomListSchema,
  transferRoomSchema,
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
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.roomsRepository.list({
      ...values,
      ...(hostelId ? { hostelId } : {}),
    })
  }

  async createRoom(input: unknown) {
    const values = createRoomSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const room = await this.roomsRepository.create({
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

    await this.publishRoomInventoryEvents(room, context.authUser.id, "room.created")

    return room
  }

  async getRoom(roomId: string, organizationId: string) {
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    const [room, occupancy, allocations] = await Promise.all([
      this.roomsRepository.getById(roomId, organizationId),
      this.roomsRepository.getOccupancy(roomId, organizationId),
      this.roomsRepository.listAllocations(roomId, organizationId),
    ])
    const existingRoom = assertFound(room, "Room not found.")

    this.authService.requireHostelAccess(context, existingRoom.organization_id, existingRoom.hostel_id)

    return {
      room: existingRoom,
      occupancy,
      allocations,
    }
  }

  async updateRoom(input: unknown) {
    const values = updateRoomSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    const existingRoom = assertFound(
      await this.roomsRepository.getById(values.roomId, values.organizationId),
      "Room not found."
    )

    this.authService.requireHostelAccess(
      context,
      existingRoom.organization_id,
      existingRoom.hostel_id
    )

    const room = await this.roomsRepository.update(values.roomId, values.organizationId, {
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

    await this.publishRoomInventoryEvents(room, context.authUser.id, "room.updated")

    return room
  }

  async allocateRoom(input: unknown) {
    const values = allocateRoomSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    try {
      const allocation = await this.roomsRepository.allocateRoomAtomic({
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        roomId: values.roomId,
        residentId: values.residentId,
        bedLabel: normalizeOptionalText(values.bedLabel),
        allocatedFrom: values.allocatedFrom,
        allocatedTo: values.allocatedTo,
        monthlyFeeAmount: values.monthlyFeeAmount,
        reason: values.reason,
        actorUserId: context.authUser.id,
      })

      await this.publishAllocationEvents(allocation, context.authUser.id)

      return allocation
    } catch (error) {
      throw mapRoomAllocationError(error)
    }
  }

  async transferRoom(input: unknown) {
    const values = transferRoomSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    try {
      const allocation = await this.roomsRepository.transferRoomAtomic({
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        residentId: values.residentId,
        fromRoomId: values.fromRoomId,
        toRoomId: values.toRoomId,
        bedLabel: normalizeOptionalText(values.bedLabel),
        transferDate: values.transferDate,
        monthlyFeeAmount: values.monthlyFeeAmount,
        reason: values.reason,
        actorUserId: context.authUser.id,
      })

      await this.publishAllocationEvents(
        allocation,
        context.authUser.id,
        "room.transfer_completed"
      )

      return allocation
    } catch (error) {
      throw mapRoomAllocationError(error)
    }
  }

  private async publishAllocationEvents(
    allocation: { id: string; organization_id: string; hostel_id: string; room_id: string; resident_id: string },
    actorUserId: string,
    reason: "room.allocation_changed" | "room.transfer_completed" = "room.allocation_changed"
  ) {
    try {
      const publisher = new RealtimeEventPublisher()
      const payload = {
        allocationId: allocation.id,
        roomId: allocation.room_id,
        residentId: allocation.resident_id,
      }

      await Promise.all([
        publisher.publish({
          type: reason,
          organizationId: allocation.organization_id,
          hostelId: allocation.hostel_id,
          actorUserId,
          payload,
        }),
        publisher.publish({
          type: "vacancy.changed",
          organizationId: allocation.organization_id,
          hostelId: allocation.hostel_id,
          actorUserId,
          payload: {
            reason,
            ...payload,
          },
        }),
        publisher.publish({
          type: "dashboard.refresh",
          organizationId: allocation.organization_id,
          hostelId: allocation.hostel_id,
          actorUserId,
          payload: {
            reason,
            ...payload,
          },
        }),
      ])
    } catch (error) {
      logger.warn({
        event: "room_allocation.realtime_publish_failed",
        message: "Room allocation succeeded, but realtime refresh could not be published.",
        organizationId: allocation.organization_id,
        userId: actorUserId,
        error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
        metadata: {
          allocationId: allocation.id,
          roomId: allocation.room_id,
          residentId: allocation.resident_id,
        },
      })
    }
  }

  private async publishRoomInventoryEvents(
    room: { id: string; organization_id: string; hostel_id: string },
    actorUserId: string,
    reason: "room.created" | "room.updated"
  ) {
    try {
      const publisher = new RealtimeEventPublisher()

      await Promise.all([
        publisher.publish({
          type: "vacancy.changed",
          organizationId: room.organization_id,
          hostelId: room.hostel_id,
          actorUserId,
          payload: {
            reason,
            roomId: room.id,
          },
        }),
        publisher.publish({
          type: "dashboard.refresh",
          organizationId: room.organization_id,
          hostelId: room.hostel_id,
          actorUserId,
          payload: {
            reason,
            roomId: room.id,
          },
        }),
      ])
    } catch (error) {
      logger.warn({
        event: "room_inventory.realtime_publish_failed",
        message: "Room inventory changed, but realtime refresh could not be published.",
        organizationId: room.organization_id,
        userId: actorUserId,
        error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
        metadata: {
          roomId: room.id,
          reason,
        },
      })
    }
  }
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim()

  return normalized || undefined
}

function mapRoomAllocationError(error: unknown): never {
  const message = error instanceof Error ? error.message : ""

  if (message.includes("target_room_capacity_exceeded")) {
    throw conflict("Target room is already at full capacity.")
  }

  if (message.includes("room_capacity_exceeded")) {
    throw conflict("Room is already at full capacity.")
  }

  if (message.includes("resident_already_allocated")) {
    throw conflict("Resident already has an active room allocation.")
  }

  if (message.includes("resident_not_allocated")) {
    throw conflict("Resident does not have an active room allocation to transfer.")
  }

  if (message.includes("same_room_transfer")) {
    throw conflict("Resident is already allocated to this room.")
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
