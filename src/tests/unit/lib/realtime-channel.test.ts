import { describe, expect, it } from "vitest"

import {
  buildRealtimeEventsDependencyKey,
  normalizeRealtimeEvents,
} from "@/lib/realtime/use-realtime-channel"

describe("realtime channel helpers", () => {
  it("normalizes one broadcast event", () => {
    expect(normalizeRealtimeEvents("payment.status_changed")).toEqual([
      "payment.status_changed",
    ])
  })

  it("deduplicates multiple broadcast events while keeping their order", () => {
    expect(
      normalizeRealtimeEvents([
        "room.allocation_changed",
        "payment.status_changed",
        "room.allocation_changed",
      ])
    ).toEqual(["room.allocation_changed", "payment.status_changed"])
  })

  it("builds a stable dependency key for event batches", () => {
    expect(
      buildRealtimeEventsDependencyKey([
        "resident.updated",
        "resident.checked_out",
      ])
    ).toBe("resident.updated\u001fresident.checked_out")
  })
})
