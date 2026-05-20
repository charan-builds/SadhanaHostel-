import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Pool } from "pg"

import {
  createTestPool,
  hasTestDatabase,
  resetTestDatabase,
  seedAdminUser,
  seedOrganization,
  seedResidentAndRoom,
  withTestTransaction,
} from "@/tests/helpers"

describe.skipIf(!hasTestDatabase())("database workflows", () => {
  let pool: Pool

  beforeAll(async () => {
    pool = createTestPool()
    await resetTestDatabase(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  it("creates organization, admin, resident, and room fixtures transactionally", async () => {
    await withTestTransaction(pool, async (client) => {
      const { organization, hostel } = await seedOrganization(client)
      const { user } = await seedAdminUser(client)
      const { resident, room } = await seedResidentAndRoom(client)

      const result = await client.query<{
        organization_count: string
        resident_count: string
        room_count: string
      }>(`
        select
          (select count(*) from public.organizations where id = '${organization.id}') as organization_count,
          (select count(*) from public.residents where id = '${resident.id}') as resident_count,
          (select count(*) from public.rooms where id = '${room.id}') as room_count
      `)

      expect(hostel.organization_id).toBe(organization.id)
      expect(user.organization_id).toBe(organization.id)
      expect(result.rows[0]).toEqual({
        organization_count: "1",
        resident_count: "1",
        room_count: "1",
      })
    })
  })

  it("enforces active allocation uniqueness workflow", async () => {
    await withTestTransaction(pool, async (client) => {
      const { organization, hostel } = await seedOrganization(client)
      await seedAdminUser(client)
      const { resident, room } = await seedResidentAndRoom(client)

      await client.query(
        `
          insert into public.room_allocations (
            organization_id,
            hostel_id,
            resident_id,
            room_id,
            allocated_from,
            status
          )
          values ($1, $2, $3, $4, current_date, 'active')
        `,
        [organization.id, hostel.id, resident.id, room.id]
      )

      await expect(
        client.query(
          `
            insert into public.room_allocations (
              organization_id,
              hostel_id,
              resident_id,
              room_id,
              allocated_from,
              status
            )
            values ($1, $2, $3, $4, current_date, 'active')
          `,
          [organization.id, hostel.id, resident.id, room.id]
        )
      ).rejects.toThrow()
    })
  })
})
