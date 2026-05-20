import { Client } from "pg"

type CheckResult = {
  name: string
  status: "ok" | "failed"
  details?: unknown
}

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
      [["organizations", "users", "residents", "payments", "invoices", "audit_logs"]]
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
