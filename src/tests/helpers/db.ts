import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

import { Pool, type PoolClient } from "pg"

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations")

export function hasTestDatabase() {
  return Boolean(process.env.TEST_DATABASE_URL)
}

export function assertSafeTestDatabaseUrl(databaseUrl: string) {
  const parsed = new URL(databaseUrl)
  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "postgres"

  if (!isLocal && process.env.TEST_DATABASE_ALLOW_NONLOCAL !== "true") {
    throw new Error(
      "Refusing to run destructive test database setup against a non-local database. Set TEST_DATABASE_ALLOW_NONLOCAL=true only for disposable CI databases."
    )
  }
}

export function createTestPool() {
  const databaseUrl = process.env.TEST_DATABASE_URL

  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for database-backed tests.")
  }

  assertSafeTestDatabaseUrl(databaseUrl)

  return new Pool({
    connectionString: databaseUrl,
    max: 4,
  })
}

export async function withTestTransaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>
) {
  const client = await pool.connect()

  try {
    await client.query("begin")
    const result = await callback(client)
    await client.query("rollback")
    return result
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function resetTestDatabase(pool: Pool) {
  await pool.query(`
    drop schema if exists public cascade;
    drop schema if exists auth cascade;
    drop schema if exists storage cascade;
    create schema public;
    create schema auth;
    create schema storage;
    grant all on schema public to postgres;
    grant all on schema public to public;
  `)

  await createSupabaseTestStubs(pool)
  await applyMigrations(pool)
}

async function createSupabaseTestStubs(pool: Pool) {
  await pool.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end $$;

    create extension if not exists pgcrypto;

    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      phone text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );

    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create table storage.buckets (
      id text primary key,
      name text,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[],
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner uuid,
      metadata jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  `)
}

async function applyMigrations(pool: Pool) {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()

  for (const fileName of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, fileName), "utf8")
    await pool.query(sql)
  }
}
