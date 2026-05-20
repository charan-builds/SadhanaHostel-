"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { roomsSdk } from "@/sdk"
import type {
  AllocateRoomInput,
  CreateRoomInput,
  RoomListInput,
  UpdateRoomInput,
} from "@/validations/room.validation"

export function useRooms(params: RoomListInput) {
  return useQuery({
    queryKey: queryKeys.rooms.list(params, params),
    queryFn: () => roomsSdk.list(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useRoom(roomId: string | undefined, organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rooms.detail({ organizationId }, roomId ?? "new"),
    queryFn: () => roomsSdk.get(String(roomId), String(organizationId)),
    enabled: Boolean(roomId && organizationId),
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateRoomInput) => roomsSdk.create(input),
    onSuccess: (room) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rooms.all({
          organizationId: room.organization_id,
          hostelId: room.hostel_id,
        }),
      })
    },
  })
}

export function useUpdateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateRoomInput) => roomsSdk.update(input),
    onSuccess: (room) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rooms.all({
          organizationId: room.organization_id,
          hostelId: room.hostel_id,
        }),
      })
    },
  })
}

export function useAllocateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AllocateRoomInput) => roomsSdk.allocate(input),
    onSuccess: (allocation) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rooms.all({
          organizationId: allocation.organization_id,
          hostelId: allocation.hostel_id,
        }),
      })
    },
  })
}
