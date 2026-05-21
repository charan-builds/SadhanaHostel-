import { describe, expect, it, vi } from "vitest"

import { RoomsService } from "@/services/rooms.service"
import {
  RESIDENT_ID,
  roomAllocationFixture,
  ROOM_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

function createServiceHarness() {
  const service = new RoomsService({} as never)
  const authService = {
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
  }
  const roomsRepository = {
    allocateRoomAtomic: vi.fn(),
  }

  Object.assign(service, {
    authService,
    roomsRepository,
  })

  return {
    service,
    authService,
    roomsRepository,
  }
}

describe("RoomsService", () => {
  it("maps database capacity protection to a conflict error", async () => {
    const harness = createServiceHarness()

    harness.roomsRepository.allocateRoomAtomic.mockRejectedValue(
      new Error("room_capacity_exceeded")
    )

    await expect(
      harness.service.allocateRoom({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        roomId: ROOM_ID,
        residentId: RESIDENT_ID,
        allocatedFrom: "2026-06-01",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Room is already at full capacity.",
    })

    expect(harness.roomsRepository.allocateRoomAtomic).toHaveBeenCalled()
  })

  it("delegates allocation to the atomic repository function", async () => {
    const harness = createServiceHarness()
    const allocation = roomAllocationFixture()

    harness.roomsRepository.allocateRoomAtomic.mockResolvedValue(allocation)

    await expect(
      harness.service.allocateRoom({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        roomId: ROOM_ID,
        residentId: RESIDENT_ID,
        allocatedFrom: "2026-06-01",
      })
    ).resolves.toEqual(allocation)

    expect(harness.roomsRepository.allocateRoomAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        roomId: ROOM_ID,
        residentId: RESIDENT_ID,
        allocatedFrom: "2026-06-01",
        actorUserId: adminAuthContext().authUser.id,
      })
    )
  })
})
