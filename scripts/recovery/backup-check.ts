import { Client } from "pg"

type CheckResult = {
  name: string
  status: "ok" | "failed"
  details?: unknown
}

const CRITICAL_TABLES = [
  "organizations",
  "hostels",
  "users",
  "user_roles",
  "residents",
  "resident_invites",
  "rooms",
  "room_allocations",
  "payments",
  "invoices",
  "documents",
  "audit_logs",
]

const PRIVATE_STORAGE_BUCKETS = [
  "resident-documents",
  "payment-screenshots",
  "payment-qr-codes",
  "invoices",
]

async function main() {
  const client = new Client({
    connectionString: requiredEnv("DATABASE_URL"),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  })
  const checks: CheckResult[] = []

  await client.connect()

  checks.push(await check(client, "database connectivity", "select now() as checked_at"))
  checks.push(
    await check(
      client,
      "critical table availability",
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [CRITICAL_TABLES]
    )
  )
  checks.push(
    await check(
      client,
      "critical table row-count snapshot",
      `
        with target(table_name) as (
          select unnest($1::text[])
        )
        select
          target.table_name,
          coalesce(stats.n_live_tup, 0)::bigint as estimated_rows,
          stats.last_vacuum,
          stats.last_autovacuum,
          stats.last_analyze,
          stats.last_autoanalyze
        from target
        left join pg_stat_user_tables stats
          on stats.schemaname = 'public'
         and stats.relname = target.table_name
        order by target.table_name
      `,
      [CRITICAL_TABLES]
    )
  )
  checks.push(
    await check(
      client,
      "rls enabled on tenant tables",
      `
        select relname, relrowsecurity
        from pg_class
        join pg_namespace on pg_namespace.oid = pg_class.relnamespace
        where nspname = 'public'
          and relname = any($1::text[])
      `,
      [["residents", "payments", "invoices", "leave_requests", "documents"]]
    )
  )
  checks.push(
    await check(
      client,
      "private storage bucket snapshot",
      `
        select
          buckets.id,
          buckets."public",
          buckets.file_size_limit,
          buckets.allowed_mime_types,
          count(objects.id)::int as object_count,
          max(objects.created_at) as latest_object_at
        from storage.buckets buckets
        left join storage.objects objects
          on objects.bucket_id = buckets.id
        where buckets.id = any($1::text[])
        group by buckets.id, buckets."public", buckets.file_size_limit, buckets.allowed_mime_types
        order by buckets.id
      `,
      [PRIVATE_STORAGE_BUCKETS]
    )
  )
  checks.push(
    await check(
      client,
      "audit actor referential integrity",
      `
        select count(*)::int as violations
        from public.audit_logs audit
        left join public.users users
          on users.id = audit.actor_user_id
        where audit.actor_user_id is not null
          and users.id is null
      `
    )
  )
  checks.push(
    await check(
      client,
      "recent audit activity snapshot",
      `
        select
          count(*) filter (where created_at >= now() - interval '24 hours')::int as last_24h,
          max(created_at) as latest_audit_at
        from public.audit_logs
      `
    )
  )
  checks.push(
    await check(
      client,
      "database size snapshot",
      "select pg_size_pretty(pg_database_size(current_database())) as database_size"
    )
  )

  await client.end()

  const failed = checks.filter((result) => result.status === "failed")
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2))

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

async function check(
  client: Client,
  name: string,
  sql: string,
  params: unknown[] = []
): Promise<CheckResult> {
  try {
    const result = await client.query(sql, params)

    return {
      name,
      status: "ok",
      details: {
        rowCount: result.rowCount,
        sample: result.rows.slice(0, 5),
      },
    }
  } catch (error) {
    return {
      name,
      status: "failed",
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
