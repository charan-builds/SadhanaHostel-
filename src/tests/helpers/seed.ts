import type { PoolClient } from "pg"

import {
  hostelFixture,
  organizationFixture,
  publicUserInsertFixture,
  residentInsertFixture,
  roomInsertFixture,
  userRoleFixture,
} from "@/tests/fixtures"

export async function seedOrganization(client: PoolClient) {
  const organization = organizationFixture()
  const hostel = hostelFixture()

  await client.query(
    `
      insert into public.organizations (id, name, legal_name, slug, status, country, settings, is_active)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (id) do nothing
    `,
    [
      organization.id,
      organization.name,
      organization.legal_name,
      organization.slug,
      organization.status,
      organization.country,
      organization.settings,
      organization.is_active,
    ]
  )

  await client.query(
    `
      insert into public.hostels (id, organization_id, name, code, slug, capacity, settings, is_active)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (id) do nothing
    `,
    [
      hostel.id,
      hostel.organization_id,
      hostel.name,
      hostel.code,
      hostel.slug,
      hostel.capacity,
      hostel.settings,
      hostel.is_active,
    ]
  )

  return { organization, hostel }
}

export async function seedAdminUser(client: PoolClient) {
  const user = publicUserInsertFixture()
  const role = userRoleFixture()

  await client.query(
    "insert into auth.users (id, email, phone) values ($1, $2, $3) on conflict (id) do nothing",
    [user.id, user.email, user.phone]
  )
  await client.query(
    `
      insert into public.users (id, organization_id, full_name, email, phone, default_role)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do nothing
    `,
    [user.id, user.organization_id, user.full_name, user.email, user.phone, user.default_role]
  )
  await client.query(
    `
      insert into public.user_roles (id, organization_id, hostel_id, user_id, role, permissions, status, accepted_at)
      values ($1, $2, $3, $4, $5, $6, $7, now())
      on conflict do nothing
    `,
    [
      role.id,
      role.organization_id,
      role.hostel_id,
      role.user_id,
      role.role,
      role.permissions,
      role.status,
    ]
  )

  return { user, role }
}

export async function seedResidentAndRoom(client: PoolClient) {
  const resident = residentInsertFixture()
  const room = roomInsertFixture()

  await client.query(
    `
      insert into public.residents (id, organization_id, hostel_id, admission_number, full_name, resident_type, status)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do nothing
    `,
    [
      resident.id,
      resident.organization_id,
      resident.hostel_id,
      resident.admission_number,
      resident.full_name,
      resident.resident_type,
      resident.status,
    ]
  )
  await client.query(
    `
      insert into public.rooms (id, organization_id, hostel_id, room_number, capacity)
      values ($1, $2, $3, $4, $5)
      on conflict (id) do nothing
    `,
    [room.id, room.organization_id, room.hostel_id, room.room_number, room.capacity]
  )

  return { resident, room }
}
