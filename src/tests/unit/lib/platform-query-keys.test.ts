import { describe, expect, it } from "vitest"

import { queryKeys } from "@/lib/react-query"

describe("platform query keys", () => {
  it("scopes setup, organization, and hostel settings by tenant", () => {
    const scope = {
      organizationId: "00000000-0000-4000-8000-000000000001",
    }

    expect(queryKeys.platform.setupStatus(scope)).toEqual([
      "tenant",
      scope.organizationId,
      "global",
      "platform",
      "setup-status",
    ])
    expect(queryKeys.platform.organization(scope)).toEqual([
      "tenant",
      scope.organizationId,
      "global",
      "platform",
      "organization",
    ])
    expect(queryKeys.platform.hostels(scope)).toEqual([
      "tenant",
      scope.organizationId,
      "global",
      "platform",
      "hostels",
    ])
  })

  it("keeps pre-organization setup status isolated from real tenants", () => {
    expect(queryKeys.platform.setupStatus({ organizationId: null })).toEqual([
      "tenant",
      "none",
      "global",
      "platform",
      "setup-status",
    ])
  })
})
