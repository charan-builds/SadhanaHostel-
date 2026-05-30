import { beforeEach, describe, expect, it, vi } from "vitest"

import { logError } from "@/lib/logger/error-logger"
import { logger } from "@/lib/logger/logger"

vi.mock("@/lib/logger/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("API error logging", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("downgrades expected auth rejections so smoke probes do not look like incidents", () => {
    logError(new Error("Authentication is required."), {
      requestId: "req-auth",
      code: "UNAUTHORIZED",
      statusCode: 401,
    })

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "application.auth_rejected",
        message: "Request rejected by auth guard.",
        requestId: "req-auth",
      })
    )
    expect(logger.error).not.toHaveBeenCalled()
  })

  it("keeps validation mistakes below warning and server failures at error level", () => {
    logError(new Error("Validation failed."), {
      requestId: "req-validation",
      code: "VALIDATION_ERROR",
      statusCode: 422,
    })
    logError(new Error("Database unavailable."), {
      requestId: "req-db",
      code: "DATABASE_ERROR",
      statusCode: 500,
    })

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "application.client_error",
        requestId: "req-validation",
      })
    )
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "application.error",
        requestId: "req-db",
      })
    )
  })
})
