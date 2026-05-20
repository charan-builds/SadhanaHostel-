import { describe, expect, it, vi } from "vitest"

import { RoomsService } from "@/services/rooms.service"
import {
  RESIDENT_ID,
  residentFixture,
  roomAllocationFixture,
  roomFixture,
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
    getById: vi.fn(),
    getActiveAllocationForResident: vi.fn(),
    listActiveAllocations: vi.fn(),
    createAllocation: vi.fn(),
  }
  const residentsRepository = {
    getById: vi.fn(),
  }

  Object.assign(service, {
    authService,
    roomsRepository,
    residentsRepository,
  })

  return {
    service,
    authService,
    roomsRepository,
    residentsRepository,
  }
}

describe("RoomsService", () => {
  it("prevents room over-allocation", async () => {
    const harness = createServiceHarness()

    harness.roomsRepository.getById.mockResolvedValue(roomFixture({ capacity: 1 }))
    harness.residentsRepository.getById.mockResolvedValue(residentFixture())
    harness.roomsRepository.getActiveAllocationForResident.mockResolvedValue(null)
    harness.roomsRepository.listActiveAllocations.mockResolvedValue([
      roomAllocationFixture(),
    ])

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

    expect(harness.roomsRepository.createAllocation).not.toHaveBeenCalled()
  })

  it("creates allocation when room has capacity", async () => {
    const harness = createServiceHarness()
    const allocation = roomAllocationFixture()

    harness.roomsRepository.getById.mockResolvedValue(roomFixture({ capacity: 2 }))
    harness.residentsRepository.getById.mockResolvedValue(residentFixture())
    harness.roomsRepository.getActiveAllocationForResident.mockResolvedValue(null)
    harness.roomsRepository.listActiveAllocations.mockResolvedValue([])
    harness.roomsRepository.createAllocation.mockResolvedValue(allocation)

    await expect(
      harness.service.allocateRoom({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        roomId: ROOM_ID,
        residentId: RESIDENT_ID,
        allocatedFrom: "2026-06-01",
      })
    ).resolves.toEqual(allocation)

    expect(harness.roomsRepository.createAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        room_id: ROOM_ID,
        resident_id: RESIDENT_ID,
        monthly_fee_amount: 6500,
      })
    )
  })
})
