import { describe, expect, it, vi } from "vitest"

import { ResidentsService } from "@/services/residents.service"
import {
  residentFixture,
  RESIDENT_ID,
  ROOM_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

function createServiceHarness() {
  const authService = {
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
    requireHostelAccess: vi.fn(),
    resolveHostelScope: vi.fn((_context, _organizationId, hostelId) => hostelId ?? null),
  }
  const residentsRepository = {
    create: vi.fn(),
    getById: vi.fn(),
    findAdmissionDuplicate: vi.fn().mockResolvedValue(null),
    deactivate: vi.fn(),
    checkout: vi.fn(),
    update: vi.fn(),
  }
  const residentInviteService = {
    createResidentInvite: vi.fn().mockResolvedValue({
      invite: {
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: RESIDENT_ID,
      },
      activationLink: "https://example.com/activate",
      loginLink: "https://example.com/resident/login",
      whatsappShareUrl: "https://wa.me/919000000002",
      delivery: {
        emailQueued: false,
        whatsappReady: true,
        accessMode: "activation_link",
        temporaryPassword: null,
      },
    }),
  }
  const operationsRepository = {
    repairResidentLifecycle: vi.fn().mockResolvedValue({
      dryRun: false,
      correlationId: "repair-correlation-1",
      residentId: RESIDENT_ID,
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      authMatchCount: 1,
      selectedAuthUserId: "auth-user-1",
      repairs: {
        expiredInvites: 1,
        duplicateInvitesRevoked: 1,
        staleInvitesRevoked: 0,
        authLinkRepaired: 1,
        profilesSynced: 1,
        rolesSynced: 1,
        onboardingAdvanced: 1,
        allocationsReleased: 0,
        feeRecordsCancelled: 0,
        invoicesCancelled: 0,
        hostelsRecalculated: 0,
      },
      timeline: [
        {
          stage: "resident_locked",
        },
      ],
    }),
  }
  const service = new ResidentsService({} as never, {
    authService: authService as never,
    residentsRepository: residentsRepository as never,
    residentInviteService: residentInviteService as never,
    operationsRepository: operationsRepository as never,
  })
  const roomsRepository = {
    allocateRoomAtomic: vi.fn(),
  }

  Object.assign(service, {
    roomsRepository,
  })

  return {
    service,
    authService,
    residentsRepository,
    residentInviteService,
    operationsRepository,
    roomsRepository,
  }
}

describe("ResidentsService", () => {
  it("creates a quick draft resident with a preferred room without consuming occupancy", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "draft", joined_on: null })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        admissionNumber: "SBH-T-010",
        fullName: "New Resident",
        phone: "+91 90000 01010",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
        roomId: ROOM_ID,
        bedLabel: "B",
        allocatedFrom: "2026-06-01",
      })
    ).resolves.toMatchObject({ resident: draftResident })

    expect(harness.residentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        metadata: expect.objectContaining({
          requested_room_assignment: {
            room_id: ROOM_ID,
            bed_label: "B",
            allocated_from: "2026-06-01",
          },
        }),
      })
    )
    expect(harness.roomsRepository.allocateRoomAtomic).not.toHaveBeenCalled()
    expect(harness.residentInviteService.createResidentInvite).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      residentId: draftResident.id,
      deliveryChannel: "whatsapp",
      expiresInHours: 72,
    })
  })

  it("does not roll back a draft resident when a preferred room is supplied", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "draft", joined_on: null })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        admissionNumber: "SBH-T-011",
        fullName: "Overflow Resident",
        phone: "+91 90000 01011",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
        roomId: ROOM_ID,
        allocatedFrom: "2026-06-01",
      })
    ).resolves.toMatchObject({ resident: draftResident })

    expect(harness.roomsRepository.allocateRoomAtomic).not.toHaveBeenCalled()
    expect(harness.residentsRepository.deactivate).not.toHaveBeenCalled()
  })

  it("creates quick draft residents with generated admission numbers", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({
      status: "draft",
      admission_number: "DRAFT-ABC-1234",
      phone: "+91 90000 01012",
      joined_on: null,
    })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fullName: "Quick Resident",
        phone: "+91 90000 01012",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
      })
    ).resolves.toMatchObject({ resident: draftResident })

    expect(harness.residentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        admission_number: expect.stringMatching(/^DRAFT-/),
        status: "draft",
        phone: "+919000001012",
        metadata: expect.objectContaining({
          admission_flow: "quick_admin_create",
          profile_completion_required: true,
        }),
      })
    )
    expect(harness.roomsRepository.allocateRoomAtomic).not.toHaveBeenCalled()
  })

  it("returns operational duplicate guidance before insert", async () => {
    const harness = createServiceHarness()
    const existingResident = residentFixture({
      status: "draft",
      admission_number: "SBH-DRAFT-009",
      phone: "+91 90000 01013",
      user_id: null,
    })

    harness.residentsRepository.findAdmissionDuplicate.mockResolvedValue({
      resident: existingResident,
      matchedFields: ["phone"],
    })

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fullName: "Duplicate Resident",
        phone: "+91 90000 01013",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: expect.objectContaining({
        type: "resident_duplicate",
        resident: expect.objectContaining({
          id: existingResident.id,
          admissionNumber: "SBH-DRAFT-009",
        }),
      }),
    })

    expect(harness.residentsRepository.create).not.toHaveBeenCalled()
  })

  it("checks out residents through the atomic repository function", async () => {
    const harness = createServiceHarness()
    const checkedOutResident = residentFixture({
      status: "checked_out",
      is_active: false,
      checkout_on: "2026-06-30",
    })

    harness.residentsRepository.checkout.mockResolvedValue(checkedOutResident)
    harness.residentsRepository.getById.mockResolvedValue(checkedOutResident)

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

  it("repairs a resident lifecycle through the tenant-scoped repair RPC", async () => {
    const harness = createServiceHarness()
    const resident = {
      ...residentFixture({
      status: "draft",
      user_id: null,
      }),
      onboarding_status: "invited",
    }

    harness.residentsRepository.getById.mockResolvedValue(resident)

    await expect(
      harness.service.repairResidentLifecycle({
        residentId: resident.id,
        organizationId: TEST_ORGANIZATION_ID,
        dryRun: false,
      })
    ).resolves.toMatchObject({
      residentId: RESIDENT_ID,
      repairs: expect.objectContaining({
        authLinkRepaired: 1,
        duplicateInvitesRevoked: 1,
      }),
    })

    expect(harness.authService.requirePermission).toHaveBeenCalledWith("settings.manage")
    expect(harness.authService.requireHostelAccess).toHaveBeenCalledWith(
      expect.anything(),
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
    expect(harness.operationsRepository.repairResidentLifecycle).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      residentId: resident.id,
      actorUserId: adminAuthContext().authUser.id,
      dryRun: false,
    })
  })
})
