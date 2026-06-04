import { describe, expect, it } from "vitest"

import { toApiError } from "@/lib/api/api-error"
import { RepositoryError } from "@/repositories/types"

describe("api error normalization", () => {
  it("turns resident profile guard failures into actionable forbidden responses", () => {
    const error = toApiError(
      new RepositoryError("resident_profile_self_update_protected_fields", "42501")
    )

    expect(error.code).toBe("FORBIDDEN")
    expect(error.statusCode).toBe(403)
    expect(error.message).toBe(
      "Only contact and family profile fields can be updated from the resident portal."
    )
    expect(error.expose).toBe(true)
  })

  it("keeps unexpected database failures hidden", () => {
    const error = toApiError(new RepositoryError("raw database detail", "PGRST116"))

    expect(error.code).toBe("PGRST116")
    expect(error.statusCode).toBe(500)
    expect(error.message).toBe("Database operation failed.")
    expect(error.expose).toBe(false)
  })
})
