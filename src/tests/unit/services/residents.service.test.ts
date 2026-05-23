import { describe, expect, it, vi } from "vitest"

import { ResidentsService } from "@/services/residents.service"
import {
  residentFixture,
  roomAllocationFixture,
  ROOM_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

function createServiceHarness() {
  const service = new ResidentsService({} as never)
  const authService = {
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
  }
  const residentsRepository = {
    create: vi.fn(),
    getById: vi.fn(),
    deactivate: vi.fn(),
    checkout: vi.fn(),
    update: vi.fn(),
  }
  const roomsRepository = {
    allocateRoomAtomic: vi.fn(),
  }

  Object.assign(service, {
    authService,
    residentsRepository,
    roomsRepository,
  })

  return {
    service,
    authService,
    residentsRepository,
    roomsRepository,
  }
}

describe("ResidentsService", () => {
  it("creates a resident and assigns a room through the atomic allocation flow", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "draft", joined_on: null })
    const activeResident = residentFixture({ status: "active", joined_on: "2026-06-01" })
    const allocation = roomAllocationFixture({
      room_id: ROOM_ID,
      resident_id: draftResident.id,
      allocated_from: "2026-06-01",
    })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.roomsRepository.allocateRoomAtomic.mockResolvedValue(allocation)
    harness.residentsRepository.getById.mockResolvedValue(activeResident)

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        admissionNumber: "SBH-T-010",
        fullName: "New Resident",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
        roomId: ROOM_ID,
        bedLabel: "B",
        allocatedFrom: "2026-06-01",
      })
    ).resolves.toEqual(activeResident)

    expect(harness.roomsRepository.allocateRoomAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        roomId: ROOM_ID,
        residentId: draftResident.id,
        bedLabel: "B",
        allocatedFrom: "2026-06-01",
        actorUserId: adminAuthContext().authUser.id,
      })
    )
  })

  it("rolls back the created resident when initial allocation fails", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "draft", joined_on: null })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.roomsRepository.allocateRoomAtomic.mockRejectedValue(
      new Error("room_capacity_exceeded")
    )
    harness.residentsRepository.deactivate.mockResolvedValue(
      residentFixture({ status: "archived", deleted_at: "2026-06-01T00:00:00.000Z" })
    )

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        admissionNumber: "SBH-T-011",
        fullName: "Overflow Resident",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
        roomId: ROOM_ID,
        allocatedFrom: "2026-06-01",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Room is already full. Choose another room or run occupancy recalculation.",
    })

    expect(harness.residentsRepository.deactivate).toHaveBeenCalledWith(
      draftResident.id,
      TEST_ORGANIZATION_ID,
      adminAuthContext().authUser.id
    )
  })

  it("checks out residents through the atomic repository function", async () => {
    const harness = createServiceHarness()
    const checkedOutResident = residentFixture({
      status: "checked_out",
      is_active: false,
      checkout_on: "2026-06-30",
    })

    harness.residentsRepository.checkout.mockResolvedValue(checkedOutResident)

    await expect(
      harness.service.checkoutResident({
        residentId: checkedOutResident.id,
        organizationId: TEST_ORGANIZATION_ID,
        checkoutDate: "2026-06-30",
        reason: "Resident completed stay.",
      })
    ).resolves.toEqual(checkedOutResident)

    expect(harness.residentsRepository.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: checkedOutResident.id,
        organizationId: TEST_ORGANIZATION_ID,
        checkoutDate: "2026-06-30",
        actorUserId: adminAuthContext().authUser.id,
      })
    )
  })
})
