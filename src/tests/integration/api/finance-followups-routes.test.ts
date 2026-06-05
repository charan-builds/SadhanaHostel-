import { afterEach, describe, expect, it, vi } from "vitest"

import {
  RESIDENT_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import {
  createGetRequest,
  createJsonRequest,
  readApiResponse,
  routeContext,
} from "@/tests/helpers"

const FOLLOWUP_ID = "00000000-0000-4000-8000-000000000501"

describe("finance followups API routes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/finance-followups.service")
  })

  it("routes followup list filters through FinanceFollowupsService", async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: FOLLOWUP_ID,
        resident_id: RESIDENT_ID,
        priority: "high",
        status: "open",
      },
    ])

    vi.doMock("@/services/finance-followups.service", () => ({
      FinanceFollowupsService: {
        create: vi.fn().mockResolvedValue({ list }),
      },
    }))

    const { GET } = await import("@/app/api/finance/followups/route")
    const response = await GET(
      createGetRequest("/api/finance/followups", {
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        priority: "high",
        assignedTo: "00000000-0000-4000-8000-000000000011",
      })
    )
    const body = await readApiResponse<Awaited<ReturnType<typeof list>>>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(list).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      priority: "high",
      assignedTo: "00000000-0000-4000-8000-000000000011",
    })
  })

  it("routes persisted followup creation through FinanceFollowupsService", async () => {
    const create = vi.fn().mockResolvedValue({
      id: FOLLOWUP_ID,
      resident_id: RESIDENT_ID,
      note: "Call again tomorrow.",
      priority: "critical",
      status: "open",
    })

    vi.doMock("@/services/finance-followups.service", () => ({
      FinanceFollowupsService: {
        create: vi.fn().mockResolvedValue({ create }),
      },
    }))

    const { POST } = await import("@/app/api/finance/followups/route")
    const payload = {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      notes: "Call again tomorrow.",
      priority: "critical",
      assignedTo: "00000000-0000-4000-8000-000000000011",
      nextFollowupAt: "2026-06-06T10:00:00.000Z",
    }
    const response = await POST(createJsonRequest("/api/finance/followups", payload))
    const body = await readApiResponse<Awaited<ReturnType<typeof create>>>(response)

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(create).toHaveBeenCalledWith(payload)
  })

  it("routes followup completion notes through FinanceFollowupsService", async () => {
    const complete = vi.fn().mockResolvedValue({
      id: FOLLOWUP_ID,
      status: "completed",
      note: "Collected during morning rounds.",
    })

    vi.doMock("@/services/finance-followups.service", () => ({
      FinanceFollowupsService: {
        create: vi.fn().mockResolvedValue({ complete }),
      },
    }))

    const { POST } = await import("@/app/api/finance/followups/[id]/complete/route")
    const payload = {
      organizationId: TEST_ORGANIZATION_ID,
      notes: "Collected during morning rounds.",
    }
    const response = await POST(
      createJsonRequest(`/api/finance/followups/${FOLLOWUP_ID}/complete`, payload),
      routeContext({ id: FOLLOWUP_ID })
    )
    const body = await readApiResponse<Awaited<ReturnType<typeof complete>>>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(complete).toHaveBeenCalledWith({
      ...payload,
      followupId: FOLLOWUP_ID,
    })
  })
})
