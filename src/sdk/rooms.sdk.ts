import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  AllocateRoomInput,
  CreateRoomInput,
  RoomListInput,
  TransferRoomInput,
  UpdateRoomInput,
} from "@/validations/room.validation"

import type { PaginatedResult } from "./types"

export const roomsSdk = {
  list(params: RoomListInput) {
    return apiClient.get<PaginatedResult<Tables<"rooms">>>("/api/rooms", params)
  },

  get(roomId: string, organizationId: string) {
    return apiClient.get<Tables<"rooms">>(`/api/rooms/${roomId}`, {
      organizationId,
    })
  },

  create(input: CreateRoomInput) {
    return apiClient.post<Tables<"rooms">, CreateRoomInput>("/api/rooms", input)
  },

  update(input: UpdateRoomInput) {
    const { roomId, ...body } = input

    return apiClient.patch<Tables<"rooms">, Omit<UpdateRoomInput, "roomId">>(
      `/api/rooms/${roomId}`,
      body
    )
  },

  allocate(input: AllocateRoomInput) {
    const { roomId, ...body } = input

    return apiClient.post<Tables<"room_allocations">, Omit<AllocateRoomInput, "roomId">>(
      `/api/rooms/${roomId}/allocate`,
      body
    )
  },

  transfer(input: TransferRoomInput) {
    const { toRoomId, ...body } = input

    return apiClient.post<Tables<"room_allocations">, Omit<TransferRoomInput, "toRoomId">>(
      `/api/rooms/${toRoomId}/transfer`,
      body
    )
  },
}
