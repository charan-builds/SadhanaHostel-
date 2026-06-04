import { describe, expect, it, vi } from "vitest"

import { HOSTEL_RULES_VERSION } from "@/constants/hostel"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { ResidentWithOnboarding } from "@/repositories/residents.repository"
import { ResidentOnboardingService } from "@/services/onboarding/resident-onboarding.service"
import {
  RESIDENT_USER_ID,
  residentFixture,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { residentAuthContext } from "@/tests/helpers"

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({})),
}))

describe("ResidentOnboardingService", () => {
  it("saves hostel rules acceptance before completing resident self-onboarding", async () => {
    const resident: ResidentWithOnboarding = {
      ...residentFixture({
      date_of_birth: "2000-01-01",
      permanent_address: "Sadhana Boys Hostel, Pulivendula, Andhra Pradesh",
      status: "draft",
      metadata: {
        onboarding: {
          collegeName: "Existing college",
        },
      },
      }),
      onboarding_status: "profile_incomplete",
    }
    const completedResident: ResidentWithOnboarding = {
      ...resident,
      status: "active",
      onboarding_status: "verified",
    }
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue(
        residentAuthContext({
          authUser: {
            ...residentAuthContext().authUser,
            id: RESIDENT_USER_ID,
          },
        })
      ),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getByUserId: vi.fn().mockResolvedValue(resident),
    }
    const completeOnboarding = vi.fn().mockResolvedValue(completedResident)
    const service = new ResidentOnboardingService({} as never)
    const serviceHarness = service as unknown as {
      authService: typeof authService
      residentsRepository: Pick<ResidentsRepository, "getByUserId">
      completeOnboardingWithoutAdminReview: typeof completeOnboarding
    }

    serviceHarness.authService = authService
    serviceHarness.residentsRepository = residentsRepository as never
    serviceHarness.completeOnboardingWithoutAdminReview = completeOnboarding

    await expect(
      service.submitForVerification({
        organizationId: TEST_ORGANIZATION_ID,
        rulesAccepted: true,
      })
    ).resolves.toMatchObject({
      resident: completedResident,
    })

    const acceptedResident = completeOnboarding.mock.calls[0]?.[0]
    const metadata = acceptedResident?.metadata as Record<string, unknown>
    const onboarding = metadata.onboarding as Record<string, unknown>
    const acceptance = onboarding.hostelRulesAcceptance as Record<string, unknown>

    expect(onboarding.collegeName).toBe("Existing college")
    expect(acceptance).toMatchObject({
      accepted: true,
      version: HOSTEL_RULES_VERSION,
      acceptedByUserId: RESIDENT_USER_ID,
    })
    expect(acceptance.acceptedAt).toEqual(expect.any(String))
    expect(completeOnboarding).toHaveBeenCalledWith(
      expect.any(Object),
      TEST_ORGANIZATION_ID,
      RESIDENT_USER_ID
    )
  })

  it("marks self-completed onboarding as trigger-compatible verification metadata", async () => {
    const now = "2026-06-04T00:00:00.000Z"
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))

    const resident: ResidentWithOnboarding = {
      ...residentFixture({
        date_of_birth: "2000-01-01",
        permanent_address: "Sadhana Boys Hostel, Pulivendula, Andhra Pradesh",
        status: "draft",
      }),
      onboarding_status: "profile_incomplete",
      onboarding_metadata: {
        activation: {
          activated_at: "2026-06-03T00:00:00.000Z",
        },
      },
    }
    const updateExtended = vi
      .spyOn(ResidentsRepository.prototype, "updateExtended")
      .mockResolvedValue({
        ...resident,
        status: "active",
        onboarding_status: "verified",
      })
    const getById = vi
      .spyOn(ResidentsRepository.prototype, "getById")
      .mockResolvedValue(null)
    const service = new ResidentOnboardingService({} as never)
    const serviceHarness = service as unknown as {
      completeOnboardingWithoutAdminReview(
        resident: ResidentWithOnboarding,
        organizationId: string,
        actorUserId: string
      ): Promise<ResidentWithOnboarding>
    }

    await serviceHarness.completeOnboardingWithoutAdminReview(
      resident,
      TEST_ORGANIZATION_ID,
      RESIDENT_USER_ID
    )

    expect(updateExtended).toHaveBeenCalledWith(
      resident.id,
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        onboarding_metadata: expect.objectContaining({
          activation: {
            activated_at: "2026-06-03T00:00:00.000Z",
          },
          self_completion: true,
          legacy_verification: true,
          verificationMode: "resident_self_completion",
          verifiedWithoutAdminReviewAt: now,
        }),
        onboarding_status: "verified",
        status: "active",
      })
    )

    updateExtended.mockRestore()
    getById.mockRestore()
    vi.useRealTimers()
  })
})
