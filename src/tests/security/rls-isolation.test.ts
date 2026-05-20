import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Pool } from "pg"

import {
  OTHER_ORGANIZATION_ID,
  OTHER_RESIDENT_USER_ID,
  RESIDENT_USER_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import {
  createTestPool,
  hasTestDatabase,
  resetTestDatabase,
  seedAdminUser,
  seedOrganization,
  seedResidentAndRoom,
  withTestTransaction,
} from "@/tests/helpers"

describe.skipIf(!hasTestDatabase())("RLS tenant isolation", () => {
  let pool: Pool

  beforeAll(async () => {
    pool = createTestPool()
    await resetTestDatabase(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  it("blocks resident access to another tenant data", async () => {
    await withTestTransaction(pool, async (client) => {
      await seedOrganization(client)
      await seedAdminUser(client)
      await seedResidentAndRoom(client)

      await client.query(
        `
          insert into auth.users (id, email) values ($1, 'resident.security@example.com');
          insert into public.users (id, organization_id, full_name, email, default_role)
          values ($1, $2, 'Resident Security', 'resident.security@example.com', 'resident');
          update public.residents set user_id = $1 where organization_id = $2;
          insert into public.user_roles (organization_id, user_id, role, status, accepted_at)
          values ($2, $1, 'resident', 'active', now());
        `,
        [RESIDENT_USER_ID, TEST_ORGANIZATION_ID]
      )

      await client.query(
        `
          insert into public.organizations (id, name, slug)
          values ($1, 'Other Tenant', 'other-tenant-security');
        `,
        [OTHER_ORGANIZATION_ID]
      )

      await client.query("set local role authenticated")
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [
        RESIDENT_USER_ID,
      ])
      const visible = await client.query(
        "select count(*)::int as count from public.organizations where id = $1",
        [OTHER_ORGANIZATION_ID]
      )

      expect(visible.rows[0].count).toBe(0)
    })
  })

  it("blocks direct resident access to another resident profile", async () => {
    await withTestTransaction(pool, async (client) => {
      const { organization } = await seedOrganization(client)
      await seedAdminUser(client)
      const { resident } = await seedResidentAndRoom(client)

      await client.query(
        `
          insert into auth.users (id, email) values ($1, 'other.resident@example.com');
          insert into public.users (id, organization_id, full_name, email, default_role)
          values ($1, $2, 'Other Resident', 'other.resident@example.com', 'resident');
          insert into public.user_roles (organization_id, user_id, role, status, accepted_at)
          values ($2, $1, 'resident', 'active', now());
        `,
        [OTHER_RESIDENT_USER_ID, organization.id]
      )

      await client.query("set local role authenticated")
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [
        OTHER_RESIDENT_USER_ID,
      ])
      const visible = await client.query(
        "select count(*)::int as count from public.residents where id = $1",
        [resident.id]
      )

      expect(visible.rows[0].count).toBe(0)
    })
  })
})
