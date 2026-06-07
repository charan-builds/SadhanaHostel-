import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { loadEnvConfig } from "@next/env"
import { Client } from "pg"

import {
  assertRestoreTargetIsIsolated,
  createSignedUrl,
  CRITICAL_TABLES,
  listBuckets,
  listObjectsRecursive,
  MANUAL_STORAGE_BUCKETS,
  readManualDrManifest,
  requiredEnv,
  verifySignedUrlAccess,
  type CriticalTable,
  type ManualStorageBucket,
  type RowCount,
  type StorageEndpoint,
} from "./manual-dr-common"

loadEnvConfig(process.cwd())

const execFileAsync = promisify(execFile)

const FINANCE_INVARIANTS = [
  "verified_payments_missing_invoice",
  "verified_payments_missing_receipt",
  "paid_zero_balance_fee_records_missing_invoice",
  "paid_invoice_payment_total_mismatch",
] as const

type Blocker = {
  id: string
  detail: string
}

type RestoreReport = {
  rto?: Record<string, unknown>
}

async function main() {
  const validationStartedAt = Date.now()
  const backupDir = path.resolve(process.argv[2] ?? requiredArgument())
  const manifest = await readManualDrManifest(backupDir)
  const restoreDatabaseUrl = requiredEnv("RESTORE_DATABASE_URL")
  const restoreEndpoint = await resolveRestoreStorageEndpoint()
  const blockers: Blocker[] = []

  assertRestoreTargetIsIsolated(process.env.DATABASE_URL, restoreDatabaseUrl)

  const restoredRows = await collectRestoredRowCounts(restoreDatabaseUrl)
  const restoredStorage = await collectRestoredStorageEvidence(restoreEndpoint, blockers)
  const finance = await collectFinanceInvariants(restoreDatabaseUrl)

  compareRows(manifest.database.rowCounts, restoredRows, blockers)
  compareStorage(
    manifest.storage.buckets.map((bucket) => ({
      bucket: bucket.bucket,
      objects: bucket.objectCount,
    })),
    restoredStorage.counts,
    blockers
  )
  verifyFinanceInvariants(finance.counts, blockers)

  const dbRestoreReport = await readOptionalJson(path.join(backupDir, "manual-db-restore-report.json"))
  const storageRestoreReport = await readOptionalJson(
    path.join(backupDir, "manual-storage-restore-report.json")
  )
  const validationDurationMs = Date.now() - validationStartedAt
  const rowLoss = calculateLoss(
    manifest.database.rowCounts.map((row) => ({ key: row.table, count: row.rows })),
    restoredRows.map((row) => ({ key: row.table, count: row.rows }))
  )
  const objectLoss = calculateLoss(
    manifest.storage.buckets.map((bucket) => ({
      key: bucket.bucket,
      count: bucket.objectCount,
    })),
    restoredStorage.counts.map((bucket) => ({
      key: bucket.bucket,
      count: bucket.objects,
    }))
  )

  const report = {
    ok: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    backupName: manifest.backupName,
    evidence: {
      manifest: path.join(backupDir, "backup-manifest.json"),
      databaseRestoreReport: dbRestoreReport ? path.join(backupDir, "manual-db-restore-report.json") : null,
      storageRestoreReport: storageRestoreReport
        ? path.join(backupDir, "manual-storage-restore-report.json")
        : null,
    },
    counts: {
      source: manifest.database.rowCounts,
      restore: restoredRows,
    },
    storageValidation: {
      source: manifest.storage.buckets.map((bucket) => ({
        bucket: bucket.bucket,
        objects: bucket.objectCount,
      })),
      restore: restoredStorage.counts,
      signedUrlChecks: restoredStorage.signedUrlChecks,
    },
    financeValidation: finance,
    rto: {
      backupDurationMs: manifest.database.durationMs + manifest.storage.durationMs + (manifest.googleDrive.uploadDurationMs ?? 0),
      databaseRestoreDurationMs: numberFromReport(dbRestoreReport, "databaseRestoreDurationMs"),
      storageRestoreDurationMs: numberFromReport(storageRestoreReport, "storageRestoreDurationMs"),
      validationDurationMs,
    },
    rpo: {
      rowLoss,
      objectLoss,
      expectedMaximumDataLoss: "24 hours when daily backup automation succeeds",
    },
    blockers,
    goNoGo: blockers.length === 0 ? "GO" : "NO-GO",
  }

  console.log(JSON.stringify(report, null, 2))

  if (blockers.length > 0) {
    process.exitCode = 1
  }
}

async function collectRestoredRowCounts(databaseUrl: string): Promise<RowCount[]> {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  })

  await client.connect()

  try {
    const counts: RowCount[] = []

    for (const table of CRITICAL_TABLES) {
      const result = await client.query<{ rows: string }>(
        `select count(*)::bigint as rows from public.${table}`
      )

      counts.push({
        table,
        rows: Number(result.rows[0]?.rows ?? 0),
      })
    }

    return counts
  } finally {
    await client.end()
  }
}

async function collectRestoredStorageEvidence(
  endpoint: StorageEndpoint,
  blockers: Blocker[]
) {
  const buckets = await listBuckets(endpoint)
  const bucketMap = new Map(buckets.map((bucket) => [bucket.id, bucket]))
  const counts = []
  const signedUrlChecks = []

  for (const bucket of MANUAL_STORAGE_BUCKETS) {
    if (!bucketMap.has(bucket)) {
      blockers.push({
        id: `restore-storage-bucket-missing-${bucket}`,
        detail: `Restore storage bucket ${bucket} is missing.`,
      })
      counts.push({ bucket, objects: 0 })
      continue
    }

    const objects = await listObjectsRecursive(endpoint, bucket)
    counts.push({ bucket, objects: objects.length })

    const sample = objects[0]?.path ?? null

    if (sample) {
      const signedUrl = await createSignedUrl(endpoint, bucket, sample)
      const accessible = signedUrl ? await verifySignedUrlAccess(signedUrl) : false

      if (!accessible) {
        blockers.push({
          id: `restore-storage-signed-url-failed-${bucket}`,
          detail: `Signed URL for restore bucket ${bucket} sample ${sample} is not accessible.`,
        })
      }

      signedUrlChecks.push({
        bucket,
        sample,
        accessible,
      })
    } else {
      signedUrlChecks.push({
        bucket,
        sample,
        accessible: null,
      })
    }
  }

  return { counts, signedUrlChecks }
}

async function collectFinanceInvariants(databaseUrl: string) {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  })

  await client.connect()

  try {
    const scope = await client.query<{ organization_id: string | null; hostel_id: string | null }>(
      `
        select
          (select id::text from public.organizations order by created_at asc limit 1) as organization_id,
          (select id::text from public.hostels order by created_at asc limit 1) as hostel_id
      `
    )
    const organizationId = scope.rows[0]?.organization_id
    const hostelId = scope.rows[0]?.hostel_id

    if (!organizationId) {
      return {
        ok: false,
        counts: null,
        error: "No organization found in restore target.",
      }
    }

    const result = await client.query<{ counts: Record<string, unknown> }>(
      `select public.financial_reconciliation_counts($1::uuid, $2::uuid) as counts`,
      [organizationId, hostelId]
    )
    const counts = normalizeFinanceCounts(result.rows[0]?.counts ?? {})

    return {
      ok: FINANCE_INVARIANTS.every((key) => counts[key] === 0),
      counts,
      error: null,
    }
  } finally {
    await client.end()
  }
}

function compareRows(sourceRows: RowCount[], restoredRows: RowCount[], blockers: Blocker[]) {
  const restored = new Map<CriticalTable, number>(
    restoredRows.map((row) => [row.table, row.rows])
  )

  for (const row of sourceRows) {
    if (restored.get(row.table) !== row.rows) {
      blockers.push({
        id: `manual-dr-row-count-mismatch-${row.table}`,
        detail: `${row.table} source=${row.rows} restore=${restored.get(row.table) ?? "missing"}.`,
      })
    }
  }
}

function compareStorage(
  sourceBuckets: Array<{ bucket: ManualStorageBucket; objects: number }>,
  restoredBuckets: Array<{ bucket: ManualStorageBucket; objects: number }>,
  blockers: Blocker[]
) {
  const restored = new Map(restoredBuckets.map((bucket) => [bucket.bucket, bucket.objects]))

  for (const bucket of sourceBuckets) {
    if (restored.get(bucket.bucket) !== bucket.objects) {
      blockers.push({
        id: `manual-dr-storage-count-mismatch-${bucket.bucket}`,
        detail: `${bucket.bucket} source=${bucket.objects} restore=${restored.get(bucket.bucket) ?? "missing"}.`,
      })
    }
  }
}

function verifyFinanceInvariants(
  counts: Record<(typeof FINANCE_INVARIANTS)[number], number> | null,
  blockers: Blocker[]
) {
  if (!counts) {
    blockers.push({
      id: "manual-dr-finance-invariants-unavailable",
      detail: "Unable to evaluate financial_reconciliation_counts on restore target.",
    })
    return
  }

  for (const key of FINANCE_INVARIANTS) {
    if (counts[key] !== 0) {
      blockers.push({
        id: `manual-dr-finance-invariant-nonzero-${key}`,
        detail: `${key}=${counts[key]}; expected 0.`,
      })
    }
  }
}

function normalizeFinanceCounts(value: Record<string, unknown>) {
  return Object.fromEntries(
    FINANCE_INVARIANTS.map((key) => [key, Number(value[key] ?? 0)])
  ) as Record<(typeof FINANCE_INVARIANTS)[number], number>
}

async function resolveRestoreStorageEndpoint(): Promise<StorageEndpoint> {
  const supabaseUrl =
    process.env.RESTORE_SUPABASE_URL ?? inferLocalSupabaseUrl(process.env.RESTORE_DATABASE_URL)
  const serviceRoleKey =
    process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.RESTORE_SERVICE_ROLE_KEY ??
    (supabaseUrl && isLocalUrl(supabaseUrl) ? await readLocalServiceRoleKey() : null)

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "RESTORE_SUPABASE_URL and RESTORE_SUPABASE_SERVICE_ROLE_KEY are required, or RESTORE_DATABASE_URL must point to a running local Supabase target."
    )
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL === supabaseUrl) {
    throw new Error("Restore storage target must not be the production Supabase URL.")
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  }
}

function calculateLoss(
  source: Array<{ key: string; count: number }>,
  restored: Array<{ key: string; count: number }>
) {
  const restoredMap = new Map(restored.map((row) => [row.key, row.count]))

  return source.reduce((total, row) => {
    return total + Math.max(row.count - (restoredMap.get(row.key) ?? 0), 0)
  }, 0)
}

async function readOptionalJson(filePath: string): Promise<RestoreReport | null> {
  const content = await readFile(filePath, "utf8").catch(() => null)

  if (!content) {
    return null
  }

  const parsed: unknown = JSON.parse(content)

  return parsed && typeof parsed === "object" ? (parsed as RestoreReport) : null
}

function numberFromReport(report: RestoreReport | null, key: string) {
  const value = report?.rto?.[key]

  return typeof value === "number" ? value : null
}

function requiredArgument() {
  throw new Error("Usage: tsx scripts/recovery/manual-dr-validation.ts <backup-dir>")
}

function inferLocalSupabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) {
    return null
  }

  try {
    const parsed = new URL(databaseUrl)

    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
      return "http://127.0.0.1:54321"
    }
  } catch {
    return null
  }

  return null
}

function isLocalUrl(value: string) {
  try {
    const parsed = new URL(value)

    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost"
  } catch {
    return false
  }
}

async function readLocalServiceRoleKey() {
  const result = await execFileAsync("supabase", ["status", "-o", "env"], {
    maxBuffer: 1024 * 1024,
  }).catch(() => null)

  if (!result) {
    return null
  }

  const value = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("SERVICE_ROLE_KEY="))
    ?.slice("SERVICE_ROLE_KEY=".length)

  return value?.replace(/^"|"$/g, "") ?? null
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
