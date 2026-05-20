import { afterEach, describe, expect, it, vi } from "vitest"

import { residentFixture, RESIDENT_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import {
  createGetRequest,
  createJsonRequest,
  readApiResponse,
  routeContext,
} from "@/tests/helpers"

describe("resident API routes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/residents.service")
  })

  it("creates a resident through ResidentsService", async () => {
    const resident = residentFixture()
    const createResident = vi.fn().mockResolvedValue(resident)

    vi.doMock("@/services/residents.service", () => ({
      ResidentsService: {
        create: vi.fn().mockResolvedValue({ createResident }),
      },
    }))

    const { POST } = await import("@/app/api/residents/route")
    const response = await POST(
      createJsonRequest("/api/residents", {
        organizationId: TEST_ORGANIZATION_ID,
        fullName: "Resident User",
      })
    )
    const body = await readApiResponse<typeof resident>(response)

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(createResident).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      fullName: "Resident User",
    })
  })

  it("loads a resident by id through ResidentsService", async () => {
    const resident = residentFixture()
    const getResident = vi.fn().mockResolvedValue(resident)

    vi.doMock("@/services/residents.service", () => ({
      ResidentsService: {
        create: vi.fn().mockResolvedValue({ getResident }),
      },
    }))

    const { GET } = await import("@/app/api/residents/[id]/route")
    const response = await GET(
      createGetRequest("/api/residents/1", {
        organizationId: TEST_ORGANIZATION_ID,
      }),
      routeContext({ id: RESIDENT_ID })
    )
    const body = await readApiResponse<typeof resident>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(getResident).toHaveBeenCalledWith(RESIDENT_ID, TEST_ORGANIZATION_ID)
  })
})
