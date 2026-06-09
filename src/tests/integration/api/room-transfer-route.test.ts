import { afterEach, describe, expect, it, vi } from "vitest"

import { unauthorized } from "@/lib/api"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { createJsonRequest, readApiResponse } from "@/tests/helpers"

const ROOM_ID = "00000000-0000-4000-8000-000000000041"
const RESIDENT_ID = "00000000-0000-4000-8000-000000000031"

describe("removed room transfer API route", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("@/services/auth.service")
  })

  it("rejects anonymous transfer attempts before exposing removed-route details", async () => {
    const requirePermission = vi.fn().mockRejectedValue(unauthorized())

    mockTransferRouteAuth(requirePermission)

    const { POST } = await import("@/app/api/rooms/[id]/transfer/route")
    const response = await POST(createTransferRequest())
    const body = await readApiResponse(response)

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(requirePermission).toHaveBeenCalledWith("rooms.manage")
  })

  it("returns the removed-route status only after room management authorization", async () => {
    const requirePermission = vi.fn().mockResolvedValue({})

    mockTransferRouteAuth(requirePermission)

    const { POST } = await import("@/app/api/rooms/[id]/transfer/route")
    const response = await POST(createTransferRequest())
    const body = await readApiResponse(response)

    expect(response.status).toBe(410)
    expect(body.success).toBe(false)
    if (body.success) {
      throw new Error("Expected removed transfer route to fail.")
    }
    expect(body.error.code).toBe("ROOM_TRANSFER_REMOVED")
  })
})

function mockTransferRouteAuth(requirePermission: ReturnType<typeof vi.fn>) {
  class MockAuthService {
    requirePermission = requirePermission
  }

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn().mockResolvedValue({}),
  }))
  vi.doMock("@/services/auth.service", () => ({
    AuthService: MockAuthService,
  }))
}

function createTransferRequest() {
  return createJsonRequest(`/api/rooms/${ROOM_ID}/transfer`, {
    organizationId: TEST_ORGANIZATION_ID,
    hostelId: TEST_HOSTEL_ID,
    residentId: RESIDENT_ID,
    transferDate: "2026-06-15",
  })
}
