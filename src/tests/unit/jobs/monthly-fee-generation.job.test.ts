import { beforeEach, describe, expect, it, vi } from "vitest"

import { monthlyFeeGenerationJob } from "@/jobs/monthly-fee-generation.job"
import {
  RESIDENT_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
  residentFixture,
} from "@/tests/fixtures"

const listActiveForBilling = vi.fn()
const findFeeRecordByResidentPeriod = vi.fn()
const createFeeRecord = vi.fn()

vi.mock("@/repositories/residents.repository", () => ({
  ResidentsRepository: vi.fn().mockImplementation(function ResidentsRepositoryMock() {
    return {
    listActiveForBilling,
    }
  }),
}))

vi.mock("@/repositories/payments.repository", () => ({
  PaymentsRepository: vi.fn().mockImplementation(function PaymentsRepositoryMock() {
    return {
      findFeeRecordByResidentPeriod,
      createFeeRecord,
    }
  }),
}))

describe("monthlyFeeGenerationJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("generates monthly fee records from resident fee amount without room allocation", async () => {
    const resident = residentFixture({
      id: RESIDENT_ID,
      monthly_fee_amount: 7250,
    })

    listActiveForBilling.mockResolvedValue([resident])
    findFeeRecordByResidentPeriod.mockResolvedValue(null)
    createFeeRecord.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000052",
    })

    await expect(
      monthlyFeeGenerationJob.run(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
          periodMonth: "2026-06-01",
        },
        {
          runId: "job-run-1",
          db: {} as never,
          startedAt: "2026-06-04T00:00:00.000Z",
          attemptNumber: 1,
          idempotencyKey: "monthly-fee-test",
        }
      )
    ).resolves.toMatchObject({
      status: "completed",
      processed: 1,
      skipped: 0,
    })

    expect(createFeeRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: RESIDENT_ID,
        room_allocation_id: null,
        period_month: "2026-06-01",
        due_date: "2026-06-01",
        base_amount: 7250,
        total_amount: 7250,
        balance_amount: 7250,
        status: "pending",
      })
    )
  })

  it("clamps resident anniversary billing to month end", async () => {
    const resident = residentFixture({
      id: RESIDENT_ID,
      joined_on: "2026-01-31",
      monthly_fee_amount: 7250,
    })

    listActiveForBilling.mockResolvedValue([resident])
    findFeeRecordByResidentPeriod.mockResolvedValue(null)
    createFeeRecord.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000053",
    })

    await monthlyFeeGenerationJob.run(
      {
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        periodMonth: "2026-02-01",
      },
      {
        runId: "job-run-2",
        db: {} as never,
        startedAt: "2026-02-01T00:00:00.000Z",
        attemptNumber: 1,
        idempotencyKey: "monthly-fee-clamp-test",
      }
    )

    expect(createFeeRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        period_month: "2026-02-01",
        due_date: "2026-02-28",
      })
    )
  })
})
