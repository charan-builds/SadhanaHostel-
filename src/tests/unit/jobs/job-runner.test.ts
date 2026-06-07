import { beforeEach, describe, expect, it, vi } from "vitest"

import { runJob } from "@/jobs/job-runner"
import type { JobDefinition } from "@/jobs/types"

const mocks = vi.hoisted(() => ({
  recordJobEvent: vi.fn(),
}))

vi.mock("@/repositories/jobs.repository", () => ({
  JobsRepository: vi.fn().mockImplementation(function JobsRepositoryMock() {
    return {
      recordJobEvent: mocks.recordJobEvent,
    }
  }),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
  },
  logError: vi.fn(),
}))

vi.mock("@/lib/metrics", () => ({
  incrementMetric: vi.fn(),
}))

vi.mock("@/lib/performance", () => ({
  measureAsync: vi.fn(
    async (_input: unknown, callback: () => Promise<unknown>) => callback()
  ),
}))

describe("runJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.recordJobEvent.mockResolvedValue({})
  })

  it("does not retry completed job work when audit logging fails", async () => {
    const jobRun = vi.fn().mockResolvedValue({
      status: "completed",
      processed: 1,
      skipped: 0,
      failed: 0,
      message: "done",
    })
    const job = jobDefinition(jobRun)
    mocks.recordJobEvent.mockRejectedValueOnce(new Error("audit table unavailable"))

    await expect(
      runJob(job, { organizationId: "org-1" }, {
        db: {} as never,
        runId: "run-audit-failure",
        organizationId: "org-1",
        retryDelayMs: 0,
      })
    ).resolves.toMatchObject({
      status: "completed",
      processed: 1,
    })

    expect(jobRun).toHaveBeenCalledTimes(1)
    expect(mocks.recordJobEvent).toHaveBeenCalledTimes(1)
  })

  it("retries failed job work with a stable run id and attempt numbers", async () => {
    const jobRun = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient db timeout"))
      .mockResolvedValueOnce({
        status: "completed",
        processed: 1,
        skipped: 0,
        failed: 0,
        message: "recovered",
      })
    const job = jobDefinition(jobRun, 2)

    await expect(
      runJob(job, { organizationId: "org-1" }, {
        db: {} as never,
        runId: "run-stable",
        organizationId: "org-1",
        retryDelayMs: 0,
      })
    ).resolves.toMatchObject({
      status: "completed",
      processed: 1,
    })

    expect(jobRun).toHaveBeenCalledTimes(2)
    expect(jobRun.mock.calls[0]?.[1]).toMatchObject({
      runId: "run-stable",
      attemptNumber: 1,
    })
    expect(jobRun.mock.calls[1]?.[1]).toMatchObject({
      runId: "run-stable",
      attemptNumber: 2,
    })
    expect(mocks.recordJobEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "job.failed",
        request_id: "run-stable",
        metadata: expect.objectContaining({
          attempt_number: 1,
        }),
      })
    )
    expect(mocks.recordJobEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "job.completed",
        request_id: "run-stable",
        metadata: expect.objectContaining({
          attempt_number: 2,
        }),
      })
    )
  })
})

function jobDefinition(
  run: JobDefinition<{ organizationId: string }>["run"],
  maxAttempts = 1
): JobDefinition<{ organizationId: string }> {
  return {
    name: "test-job",
    queueName: "test",
    maxAttempts,
    buildIdempotencyKey: (payload) => `test-job:${payload.organizationId}`,
    run,
  }
}
