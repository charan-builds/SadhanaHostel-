import { beforeEach, describe, expect, it, vi } from "vitest"

import { executeVercelCron } from "@/jobs/scheduler/vercel-cron"
import { incrementMetric } from "@/lib/metrics"

const mocks = vi.hoisted(() => ({
  db: {},
  listActiveOrganizations: vi.fn(),
  getAutomationSetting: vi.fn(),
  runJob: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  serializeError: (error: unknown) =>
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown error", value: error },
}))

vi.mock("@/lib/metrics", () => ({
  incrementMetric: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => mocks.db),
}))

vi.mock("@/repositories/organizations.repository", () => ({
  OrganizationsRepository: vi.fn().mockImplementation(function OrganizationsRepositoryMock() {
    return {
      listActiveOrganizations: mocks.listActiveOrganizations,
    }
  }),
}))

vi.mock("@/repositories/operations.repository", () => ({
  OperationsRepository: vi.fn().mockImplementation(function OperationsRepositoryMock() {
    return {
      getAutomationSetting: mocks.getAutomationSetting,
    }
  }),
}))

vi.mock("@/jobs/job-runner", () => ({
  runJob: mocks.runJob,
}))

describe("executeVercelCron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "test-cron-secret"
    process.env.CRON_JOBS_ENABLED = "true"
  })

  it("continues remaining organizations when one organization cron setup fails", async () => {
    mocks.listActiveOrganizations.mockResolvedValue([
      { id: "org-failed" },
      { id: "org-ok" },
    ])
    mocks.getAutomationSetting
      .mockRejectedValueOnce(new Error("automation setting timeout"))
      .mockResolvedValueOnce(null)
    mocks.runJob.mockResolvedValueOnce({
      status: "completed",
      processed: 2,
      skipped: 0,
      failed: 0,
      message: "queued",
    })

    const result = await executeVercelCron(cronRequest(), "payment-reminders")

    expect(result.organizationCount).toBe(2)
    expect(result.results).toEqual([
      {
        organizationId: "org-failed",
        result: expect.objectContaining({
          status: "failed",
          failed: 1,
        }),
      },
      {
        organizationId: "org-ok",
        result: expect.objectContaining({
          status: "completed",
          processed: 2,
        }),
      },
    ])
    expect(mocks.runJob).toHaveBeenCalledTimes(1)
    expect(mocks.runJob).toHaveBeenCalledWith(
      expect.objectContaining({ name: "payment_reminder" }),
      expect.objectContaining({ organizationId: "org-ok" }),
      expect.objectContaining({ organizationId: "org-ok" })
    )
    expect(incrementMetric).toHaveBeenCalledWith("cron.organization_failed", 1, {
      cronName: "payment-reminders",
      organizationId: "org-failed",
      source: "manual",
    })
    expect(incrementMetric).toHaveBeenCalledWith("cron.completed", 1, {
      cronName: "payment-reminders",
      source: "manual",
      status: "partial_failure",
    })
  })
})

function cronRequest() {
  return new Request("https://example.test/api/cron/payment-reminders", {
    headers: {
      authorization: "Bearer test-cron-secret",
      "user-agent": "vitest",
    },
  })
}
