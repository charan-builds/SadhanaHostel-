import { describe, expect, it } from "vitest"

import { getSearchResultHref, getSearchResultLabel } from "@/lib/search/routes"
import type { SearchResult } from "@/sdk/types"

describe("search result routing", () => {
  it("routes all global search entity types to reachable admin surfaces", () => {
    const entityIds: Record<SearchResult["entity_type"], string> = {
      residents: "00000000-0000-4000-8000-000000000101",
      payments: "00000000-0000-4000-8000-000000000102",
      rooms: "00000000-0000-4000-8000-000000000103",
      notices: "00000000-0000-4000-8000-000000000104",
      complaints: "00000000-0000-4000-8000-000000000105",
      reports: "00000000-0000-4000-8000-000000000106",
    }

    expect(getSearchResultHref({ entity_type: "residents", entity_id: entityIds.residents })).toBe(
      `/admin/residents/${entityIds.residents}`
    )
    expect(getSearchResultHref({ entity_type: "payments", entity_id: entityIds.payments })).toBe(
      "/admin/payments"
    )
    expect(getSearchResultHref({ entity_type: "rooms", entity_id: entityIds.rooms })).toBe(
      "/admin/rooms"
    )
    expect(getSearchResultHref({ entity_type: "notices", entity_id: entityIds.notices })).toBe(
      "/admin/notices"
    )
    expect(getSearchResultHref({ entity_type: "complaints", entity_id: entityIds.complaints })).toBe(
      "/admin/alerts"
    )
    expect(getSearchResultHref({ entity_type: "reports", entity_id: entityIds.reports })).toBe(
      "/admin/reports"
    )
  })

  it("labels search result entity types for the result list", () => {
    expect(getSearchResultLabel("residents")).toBe("Resident")
    expect(getSearchResultLabel("payments")).toBe("Payment")
    expect(getSearchResultLabel("rooms")).toBe("Room")
    expect(getSearchResultLabel("notices")).toBe("Notice")
    expect(getSearchResultLabel("complaints")).toBe("Complaint")
    expect(getSearchResultLabel("reports")).toBe("Report")
  })
})
