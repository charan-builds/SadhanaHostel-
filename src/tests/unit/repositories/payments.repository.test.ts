import { describe, expect, it, vi } from "vitest"

import { PaymentsRepository } from "@/repositories/payments.repository"

describe("PaymentsRepository", () => {
  it("orders revenue-basis payment lists by verified_at", async () => {
    const { db, query } = createListPaymentsDb()
    const repository = new PaymentsRepository(db as never)

    await repository.list({
      organizationId: "00000000-0000-4000-8000-000000000001",
      dateBasis: "revenue",
    })

    expect(query.order).toHaveBeenCalledWith("verified_at", { ascending: false })
    expect(query.eq).toHaveBeenCalledWith("status", "verified")
    expect(query.not).toHaveBeenCalledWith("verified_at", "is", null)
  })

  it("orders activity-basis payment lists by created_at", async () => {
    const { db, query } = createListPaymentsDb()
    const repository = new PaymentsRepository(db as never)

    await repository.list({
      organizationId: "00000000-0000-4000-8000-000000000001",
      dateBasis: "activity",
    })

    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false })
  })

  it("normalizes payment date filters to full-day boundaries", async () => {
    const { db, query } = createListPaymentsDb()
    const repository = new PaymentsRepository(db as never)

    await repository.list({
      organizationId: "00000000-0000-4000-8000-000000000001",
      dateBasis: "revenue",
      fromDate: "2026-06-05",
      toDate: "2026-06-05",
    })

    expect(query.gte).toHaveBeenCalledWith("verified_at", "2026-06-05T00:00:00.000Z")
    expect(query.lte).toHaveBeenCalledWith("verified_at", "2026-06-05T23:59:59.999Z")
  })
})

function createListPaymentsDb() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    not: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    range: vi.fn().mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    }),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.not.mockReturnValue(query)
  query.gte.mockReturnValue(query)
  query.lte.mockReturnValue(query)

  return {
    db: {
      from: vi.fn().mockReturnValue(query),
    },
    query,
  }
}
