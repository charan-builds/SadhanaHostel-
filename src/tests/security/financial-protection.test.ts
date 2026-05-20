import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Pool } from "pg"

import { paymentInsertFixture } from "@/tests/fixtures"
import {
  createTestPool,
  hasTestDatabase,
  resetTestDatabase,
  seedAdminUser,
  seedOrganization,
  seedResidentAndRoom,
  withTestTransaction,
} from "@/tests/helpers"

describe.skipIf(!hasTestDatabase())("financial protection", () => {
  let pool: Pool

  beforeAll(async () => {
    pool = createTestPool()
    await resetTestDatabase(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  it("prevents mutation of verified payment amounts", async () => {
    await withTestTransaction(pool, async (client) => {
      await seedOrganization(client)
      await seedAdminUser(client)
      await seedResidentAndRoom(client)
      const payment = paymentInsertFixture({ status: "verified" })

      await client.query(
        `
          insert into public.payments (
            id,
            organization_id,
            hostel_id,
            resident_id,
            amount,
            method,
            status
          )
          values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          payment.id,
          payment.organization_id,
          payment.hostel_id,
          payment.resident_id,
          payment.amount,
          payment.method,
          payment.status,
        ]
      )

      await expect(
        client.query("update public.payments set amount = 1 where id = $1", [payment.id])
      ).rejects.toThrow()
    })
  })
})
