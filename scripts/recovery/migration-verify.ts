import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { Client } from "pg"

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations")

async function main() {
  const databaseUrl =
    process.env.MIGRATION_VERIFY_DATABASE_URL ?? process.env.TEST_DATABASE_URL

  if (!databaseUrl) {
    throw new Error("MIGRATION_VERIFY_DATABASE_URL or TEST_DATABASE_URL is required.")
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  })
  const applied: string[] = []

  await client.connect()
  await client.query("begin")

  try {
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8")
      await client.query(sql)
      applied.push(file)
    }

    await client.query("rollback")
    console.log(
      JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          migrationCount: applied.length,
          applied,
          rolledBack: true,
        },
        null,
        2
      )
    )
  } catch (error) {
    await client.query("rollback")
    console.error(
      JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          applied,
          failedAfter: applied.at(-1) ?? null,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    )
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
