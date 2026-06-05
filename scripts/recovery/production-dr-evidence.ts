import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

import { loadEnvConfig } from "@next/env"
import { createClient } from "@supabase/supabase-js"
import type { WebSocketLikeConstructor } from "@supabase/realtime-js"
import { Client } from "pg"
import ws from "ws"

loadEnvConfig(process.cwd())

const execFileAsync = promisify(execFile)

const CRITICAL_TABLES = [
  "organizations",
  "hostels",
  "residents",
  "monthly_fee_records",
  "invoices",
  "payments",
  "documents",
] as const

const STORAGE_BUCKETS = [
  "resident-documents",
  "payment-screenshots",
  "payment-qr-codes",
  "invoices",
  "gallery-images",
] as const

type QueryError = {
  message: string
}

type QueryResult<T> = {
  data: T | null
  error: QueryError | null
  count?: number | null
}

type SelectBuilder<T> = PromiseLike<QueryResult<T>> & {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => PromiseLike<QueryResult<T>>
}

type Blocker = {
  id: string
  detail: string
  requiredCredential?: string
  source?: string
}

type EvidenceSupabaseClient = {
  from: (table: string) => {
    select: (
      columns?: string,
      options?: { count?: "exact"; head?: boolean }
    ) => SelectBuilder<Array<Record<string, unknown>>>
  }
  rpc: (
    name: string,
    args?: Record<string, unknown>
  ) => PromiseLike<QueryResult<unknown>>
  auth: {
    admin: {
      listUsers: (args: {
        page: number
        perPage: number
      }) => PromiseLike<QueryResult<{ users: Array<{ aud?: string | null }> }>>
    }
  }
}

type Evidence = {
  checkedAt: string
  projectRef: string | null
  backup: unknown
  source: unknown
  restoreTarget: unknown
  drReport: unknown
  blockers: Blocker[]
}

async function main() {
  const startedAt = Date.now()
  const checkedAt = new Date().toISOString()
  const blockers: Evidence["blockers"] = []
  const projectRef = await resolveProjectRef()
  const sourceClient = createSourceClient(blockers)

  const source = sourceClient
    ? await collectSourceEvidence(sourceClient, blockers)
    : { ok: false, error: "Supabase source client could not be created." }
  const restoreTarget = await collectRestoreTargetEvidence()
  const backup = projectRef
    ? await collectBackupEvidence(projectRef, blockers)
    : { ok: false, error: "Unable to resolve Supabase project ref." }

  compareSourceAndRestore(source, restoreTarget, blockers)
  compareStorageSourceAndRestore(source, restoreTarget, blockers)
  compareFinancialReconciliation(source, restoreTarget, blockers)

  const evidence: Evidence = {
    checkedAt,
    projectRef,
    backup,
    source,
    restoreTarget,
    drReport: buildDrReport({
      backup,
      source,
      restoreTarget,
      totalDurationMs: Date.now() - startedAt,
    }),
    blockers,
  }

  console.log(JSON.stringify(evidence, null, 2))

  if (blockers.length > 0) {
    process.exitCode = 1
  }
}

function createSourceClient(blockers: Evidence["blockers"]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    blockers.push({
      id: "source-service-role-missing",
      detail: "Source Supabase service-role API access is required for DR evidence collection.",
      requiredCredential: "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      source: "Supabase project API settings and secret manager",
    })
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as WebSocketLikeConstructor },
  }) as unknown as EvidenceSupabaseClient
}

async function collectBackupEvidence(projectRef: string, blockers: Evidence["blockers"]) {
  const startedAt = Date.now()
  const result = await runCommand("supabase", [
    "backups",
    "list",
    "--project-ref",
    projectRef,
    "--output",
    "json",
  ])

  if (!result.ok) {
    blockers.push({
      id: "backup-metadata-unavailable",
      detail: result.error ?? "Unable to collect Supabase backup metadata.",
      requiredCredential: "Supabase CLI login with project backup visibility",
      source: "Supabase access token for the production organization",
    })
    return { ...result, durationMs: Date.now() - startedAt }
  }

  const parsed = parseJson(result.stdout)
  const pitrEnabled = parsed?.pitr_enabled === true
  const backups = Array.isArray(parsed?.backups) ? parsed.backups : []

  if (!pitrEnabled) {
    blockers.push({
      id: "pitr-disabled",
      detail: "Supabase backup metadata reports pitr_enabled=false.",
      requiredCredential: "Organization owner or billing admin access to enable Supabase PITR add-on",
      source: "Supabase Dashboard > Database > Backups > Point in Time Recovery",
    })
  }

  if (backups.length === 0) {
    blockers.push({
      id: "no-listed-physical-backups",
      detail: "Supabase backup metadata returned an empty backups list.",
      requiredCredential: "A listed physical backup or PITR recovery window",
      source: "Supabase Dashboard > Database > Backups or Management API",
    })
  }

  return {
    ok: true,
    raw: parsed,
    pitrEnabled,
    listedBackupCount: backups.length,
    durationMs: Date.now() - startedAt,
    backupFrequency: pitrEnabled ? "PITR/WAL based" : backups.length > 0 ? "daily physical backups listed" : "unverified",
    retentionPolicy: pitrEnabled
      ? "read from PITR recovery window in dashboard/API"
      : backups.length > 0
        ? "derived from listed backup timestamps"
        : "unverified",
  }
}

async function collectSourceEvidence(
  supabase: EvidenceSupabaseClient,
  blockers: Evidence["blockers"]
) {
  const tableCounts = await Promise.all(
    CRITICAL_TABLES.map(async (table) => {
      const { count, error } = await supabase.from(table).select("id", {
        count: "exact",
        head: true,
      })

      return {
        table,
        ok: !error,
        rows: count ?? null,
        error: error?.message ?? null,
      }
    })
  )

  const { data: organizations, error: orgError } = await supabase
    .from("organizations")
    .select("id, slug, name")
    .order("created_at", { ascending: true })

  const { data: hostels, error: hostelError } = await supabase
    .from("hostels")
    .select("id, slug, name, organization_id")
    .order("created_at", { ascending: true })

  const organizationId =
    typeof organizations?.[0]?.id === "string" ? organizations[0].id : null
  const hostelId = typeof hostels?.[0]?.id === "string" ? hostels[0].id : null

  const reconciliation =
    organizationId && !orgError && !hostelError
      ? await runFinancialReconciliation(supabase, organizationId, hostelId)
      : {
          ok: false,
          error: orgError?.message ?? hostelError?.message ?? "No organization/hostel scope.",
          counts: null,
        }

  const authUsers = await collectAuthUsers(supabase, blockers)
  const storage = await collectStorageEvidence(blockers)

  for (const row of tableCounts) {
    if (!row.ok) {
      blockers.push({
        id: `source-count-${row.table}-failed`,
        detail: row.error ?? `Unable to count ${row.table}.`,
        requiredCredential: "SUPABASE_SERVICE_ROLE_KEY",
        source: "Supabase project API settings",
      })
    }
  }

  return {
    ok:
      tableCounts.every((row) => row.ok) &&
      reconciliation.ok &&
      authUsers.ok &&
      storage.ok,
    tableCounts,
    organizations: organizations ?? [],
    hostels: hostels ?? [],
    financialReconciliation: reconciliation,
    authUsers,
    storage,
  }
}

async function runFinancialReconciliation(
  supabase: EvidenceSupabaseClient,
  organizationId: string,
  hostelId: string | null
) {
  const { data, error } = await supabase.rpc("financial_reconciliation_counts", {
    p_organization_id: organizationId,
    p_hostel_id: hostelId,
  })

  return {
    ok: !error,
    error: error?.message ?? null,
    counts: data,
  }
}

async function collectAuthUsers(
  supabase: EvidenceSupabaseClient,
  blockers: Evidence["blockers"]
) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })

  if (error) {
    blockers.push({
      id: "auth-user-list-failed",
      detail: error.message,
      requiredCredential: "SUPABASE_SERVICE_ROLE_KEY",
      source: "Supabase project API settings",
    })
  }

  return {
    ok: !error,
    error: error?.message ?? null,
    firstPageUserCount: data?.users.length ?? null,
    audiences: data?.users ? Array.from(new Set(data.users.map((user) => user.aud))) : [],
  }
}

async function collectStorageEvidence(blockers: Evidence["blockers"]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      error: "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
      buckets: [],
    }
  }

  const bucketsResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    headers: storageHeaders(serviceRoleKey),
  })
  const bucketBody = await bucketsResponse.json().catch(() => null)

  if (!bucketsResponse.ok || !Array.isArray(bucketBody)) {
    blockers.push({
      id: "storage-bucket-list-failed",
      detail: JSON.stringify(bucketBody),
      requiredCredential: "SUPABASE_SERVICE_ROLE_KEY",
      source: "Supabase project API settings",
    })

    return {
      ok: false,
      error: JSON.stringify(bucketBody),
      buckets: [],
    }
  }

  const bucketMap = new Map<string, { id: string; public: boolean }>(
    bucketBody.map((bucket: { id: string; public: boolean }) => [bucket.id, bucket])
  )

  const buckets = await Promise.all(
    STORAGE_BUCKETS.map(async (bucketId) => {
      const bucket = bucketMap.get(bucketId)

      if (!bucket) {
        blockers.push({
          id: `storage-bucket-${bucketId}-missing`,
          detail: `Expected storage bucket ${bucketId} is missing.`,
          requiredCredential: "Storage bucket provisioning/migration",
          source: "Supabase Dashboard > Storage",
        })

        return { id: bucketId, exists: false, public: null, objectCount: null }
      }

      const objectEvidence = await listObjectsRecursive(supabaseUrl, serviceRoleKey, bucketId)
      const signedUrlWorks = objectEvidence.samplePath
        ? await createSignedUrl(supabaseUrl, serviceRoleKey, bucketId, objectEvidence.samplePath)
        : null

      if (objectEvidence.samplePath && !signedUrlWorks) {
        blockers.push({
          id: `source-storage-signed-url-failed-${bucketId}`,
          detail: `Unable to generate a signed URL for source bucket ${bucketId} sample ${objectEvidence.samplePath}.`,
          requiredCredential: "SUPABASE_SERVICE_ROLE_KEY with storage object signing access",
          source: "Supabase Storage API",
        })
      }

      return {
        id: bucketId,
        exists: true,
        public: bucket.public,
        objectCount: objectEvidence.objectCount,
        samplePathPresent: Boolean(objectEvidence.samplePath),
        samplePath: objectEvidence.samplePath,
        signedUrlWorks,
      }
    })
  )

  return {
    ok: buckets.every((bucket) => bucket.exists && bucket.signedUrlWorks !== false),
    buckets,
  }
}

async function listObjectsRecursive(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucketId: string,
  prefix = ""
): Promise<{ objectCount: number; samplePath: string | null }> {
  let objectCount = 0
  let samplePath: string | null = null
  let offset = 0

  while (true) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucketId}`, {
      method: "POST",
      headers: storageHeaders(serviceRoleKey),
      body: JSON.stringify({
        limit: 100,
        offset,
        prefix,
        sortBy: { column: "name", order: "asc" },
      }),
    })
    const objects = await response.json().catch(() => [])

    if (!response.ok || !Array.isArray(objects) || objects.length === 0) {
      break
    }

    for (const object of objects as Array<{ id: string | null; name: string }>) {
      const path = prefix ? `${prefix}/${object.name}` : object.name

      if (object.id) {
        objectCount += 1
        samplePath ??= path
      } else {
        const child = await listObjectsRecursive(supabaseUrl, serviceRoleKey, bucketId, path)
        objectCount += child.objectCount
        samplePath ??= child.samplePath
      }
    }

    if (objects.length < 100) {
      break
    }

    offset += objects.length
  }

  return { objectCount, samplePath }
}

async function createSignedUrl(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucketId: string,
  path: string
) {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${bucketId}/${encodeURI(path)}`,
    {
      method: "POST",
      headers: storageHeaders(serviceRoleKey),
      body: JSON.stringify({ expiresIn: 60 }),
    }
  )
  const body = await response.json().catch(() => null)

  return response.ok && Boolean(body?.signedURL ?? body?.signedUrl)
}

function storageHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

async function collectRestoreTargetEvidence() {
  const startedAt = Date.now()
  const restoreDatabaseUrl = process.env.RESTORE_DATABASE_URL ?? process.env.TEST_DATABASE_URL

  if (!restoreDatabaseUrl) {
    return {
      ok: false,
      error: "RESTORE_DATABASE_URL or TEST_DATABASE_URL is required to validate restored data.",
    }
  }

  const client = new Client({
    connectionString: restoreDatabaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  })

  await client.connect()

  try {
    const tableCounts = []

    for (const table of CRITICAL_TABLES) {
      try {
        const result = await client.query<{ rows: string }>(
          `select count(*)::bigint as rows from public.${table}`
        )

        tableCounts.push({
          table,
          ok: true,
          rows: Number(result.rows[0]?.rows ?? 0),
          error: null,
        })
      } catch (error) {
        tableCounts.push({
          table,
          ok: false,
          rows: null,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const scope = await client
      .query<{ organization_id: string | null; hostel_id: string | null }>(
        `
          select
            (select id::text from public.organizations order by created_at asc limit 1) as organization_id,
            (select id::text from public.hostels order by created_at asc limit 1) as hostel_id
        `
      )
      .then((result) => result.rows[0] ?? { organization_id: null, hostel_id: null })
      .catch(() => ({ organization_id: null, hostel_id: null }))

    const financialReconciliation =
      scope.organization_id
        ? await client
            .query<{ counts: unknown }>(
              `
                select public.financial_reconciliation_counts($1::uuid, $2::uuid) as counts
              `,
              [scope.organization_id, scope.hostel_id]
            )
            .then((result) => ({
              ok: true,
              error: null,
              counts: result.rows[0]?.counts ?? null,
            }))
            .catch((error) => ({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
              counts: null,
            }))
        : {
            ok: false,
            error: "No organization scope found in restore target.",
            counts: null,
          }

    const storageBuckets = await client
      .query<{ id: string; public: boolean; object_count: string }>(
        `
          select buckets.id, buckets.public, count(objects.id)::bigint as object_count
          from storage.buckets buckets
          left join storage.objects objects on objects.bucket_id = buckets.id
          where buckets.id = any($1::text[])
          group by buckets.id, buckets.public
          order by buckets.id
        `,
        [STORAGE_BUCKETS]
      )
      .then((result) =>
        result.rows.map((row) => ({
          id: row.id,
          public: row.public,
          objectCount: Number(row.object_count),
        }))
      )
      .catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      }))

    return {
      ok: tableCounts.every((row) => row.ok) && financialReconciliation.ok,
      databaseUrlSource: process.env.RESTORE_DATABASE_URL ? "RESTORE_DATABASE_URL" : "TEST_DATABASE_URL",
      durationMs: Date.now() - startedAt,
      tableCounts,
      financialReconciliation,
      storageBuckets,
    }
  } finally {
    await client.end()
  }
}

async function resolveProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) {
    return process.env.SUPABASE_PROJECT_REF
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      return new URL(supabaseUrl).hostname.split(".")[0] ?? null
    } catch {
      // fall through to local linked-project file
    }
  }

  try {
    return (await readFile("supabase/.temp/project-ref", "utf8")).trim()
  } catch {
    return null
  }
}

async function runCommand(command: string, args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 10,
    })

    return { ok: true, stdout, stderr }
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string }

    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      error: err.stderr || err.message,
    }
  }
}

function parseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function compareSourceAndRestore(
  source: unknown,
  restoreTarget: unknown,
  blockers: Evidence["blockers"]
) {
  const sourceCounts = getTableCounts(source)
  const restoreCounts = getTableCounts(restoreTarget)

  if (!sourceCounts || !restoreCounts) {
    return
  }

  for (const table of CRITICAL_TABLES) {
    const sourceRows = sourceCounts.get(table)
    const restoredRows = restoreCounts.get(table)

    if (sourceRows !== restoredRows) {
      blockers.push({
        id: `restore-count-mismatch-${table}`,
        detail: `Restored ${table} count ${restoredRows ?? "unavailable"} does not match source count ${sourceRows ?? "unavailable"}.`,
        requiredCredential: "RESTORE_DATABASE_URL pointing to the isolated production-data restore",
        source: "Supabase restored project connection string or local restored backup target",
      })
    }
  }
}

function compareStorageSourceAndRestore(
  source: unknown,
  restoreTarget: unknown,
  blockers: Evidence["blockers"]
) {
  const sourceBuckets = getStorageBucketCounts(source)
  const restoreBuckets = getRestoreStorageBucketCounts(restoreTarget)

  if (!sourceBuckets || !restoreBuckets) {
    blockers.push({
      id: "storage-object-count-unavailable",
      detail: "Source or restore storage object counts are unavailable.",
      requiredCredential: "Source service-role API access and RESTORE_DATABASE_URL",
      source: "Storage API and restore target storage schema",
    })
    return
  }

  const mismatches = STORAGE_BUCKETS.flatMap((bucket) => {
    const sourceCount = sourceBuckets.get(bucket)
    const restoreCount = restoreBuckets.get(bucket)

    return sourceCount === restoreCount
      ? []
      : [`${bucket}: source=${sourceCount ?? "unavailable"}, restore=${restoreCount ?? "unavailable"}`]
  })

  if (mismatches.length > 0) {
    blockers.push({
      id: "storage-object-count-mismatch",
      detail: `Storage object counts differ between source and restore target. ${mismatches.join("; ")}.`,
      requiredCredential: "A restored storage target with copied Storage API objects",
      source: "Supabase Storage source and restored storage target",
    })
  }
}

function compareFinancialReconciliation(
  source: unknown,
  restoreTarget: unknown,
  blockers: Evidence["blockers"]
) {
  const sourceCounts = getFinancialReconciliationCounts(source)
  const restoreCounts = getFinancialReconciliationCounts(restoreTarget)

  if (!sourceCounts || !restoreCounts) {
    blockers.push({
      id: "financial-reconciliation-unavailable",
      detail: "Source or restore financial reconciliation counts are unavailable.",
      requiredCredential: "financial_reconciliation_counts RPC deployed on source and restore target",
      source: "Supabase RPC and restored database",
    })
    return
  }

  const sourceJson = stableJson(sourceCounts)
  const restoreJson = stableJson(restoreCounts)

  if (sourceJson !== restoreJson) {
    blockers.push({
      id: "financial-reconciliation-mismatch",
      detail: `Source financial reconciliation counts ${sourceJson} do not match restore counts ${restoreJson}.`,
      requiredCredential: "A restored database with intact finance chain data",
      source: "financial_reconciliation_counts RPC",
    })
  }

  const nonZero = Object.entries(sourceCounts as Record<string, unknown>).filter(
    ([, value]) => Number(value) !== 0
  )

  if (nonZero.length > 0) {
    blockers.push({
      id: "financial-reconciliation-source-nonzero",
      detail: `Source financial reconciliation counters are non-zero: ${stableJson(Object.fromEntries(nonZero))}.`,
      source: "financial_reconciliation_counts RPC",
    })
  }
}

function buildDrReport(input: {
  backup: unknown
  source: unknown
  restoreTarget: unknown
  totalDurationMs: number
}) {
  const sourceTableCounts = getTableCounts(input.source)
  const restoreTableCounts = getTableCounts(input.restoreTarget)
  const sourceStorageCounts = getStorageBucketCounts(input.source)
  const restoreStorageCounts = getRestoreStorageBucketCounts(input.restoreTarget)
  const rowLoss = sumLoss(sourceTableCounts, restoreTableCounts)
  const objectLoss = sumLoss(sourceStorageCounts, restoreStorageCounts)

  return {
    database: {
      sourceCounts: mapToRows(sourceTableCounts, "table", "rows"),
      restoreCounts: mapToRows(restoreTableCounts, "table", "rows"),
    },
    storage: {
      sourceCounts: mapToRows(sourceStorageCounts, "bucket", "objects"),
      restoreCounts: mapToRows(restoreStorageCounts, "bucket", "objects"),
    },
    financial: {
      sourceReconciliation: getFinancialReconciliationCounts(input.source),
      restoreReconciliation: getFinancialReconciliationCounts(input.restoreTarget),
    },
    rto: {
      backupDurationMs: numberValue(input.backup, "durationMs"),
      restoreValidationDurationMs: numberValue(input.restoreTarget, "durationMs"),
      evidenceCollectionDurationMs: input.totalDurationMs,
    },
    rpo: {
      rowLoss,
      objectLoss,
    },
  }
}

function getTableCounts(value: unknown) {
  if (!value || typeof value !== "object" || !("tableCounts" in value)) {
    return null
  }

  const rows = (value as { tableCounts?: unknown }).tableCounts

  if (!Array.isArray(rows)) {
    return null
  }

  return new Map(
    rows
      .filter(
        (row): row is { table: string; rows: number } =>
          Boolean(row) &&
          typeof row === "object" &&
          typeof (row as { table?: unknown }).table === "string" &&
          typeof (row as { rows?: unknown }).rows === "number"
      )
      .map((row) => [row.table, row.rows])
  )
}

function getStorageBucketCounts(value: unknown) {
  if (!value || typeof value !== "object" || !("storage" in value)) {
    return null
  }

  const storage = (value as { storage?: { buckets?: unknown } }).storage
  const buckets = storage?.buckets

  if (!Array.isArray(buckets)) {
    return null
  }

  return new Map(
    buckets
      .filter(
        (bucket): bucket is { id: string; objectCount: number } =>
          Boolean(bucket) &&
          typeof bucket === "object" &&
          typeof (bucket as { id?: unknown }).id === "string" &&
          typeof (bucket as { objectCount?: unknown }).objectCount === "number"
      )
      .map((bucket) => [bucket.id, bucket.objectCount])
  )
}

function getRestoreStorageBucketCounts(value: unknown) {
  if (!value || typeof value !== "object" || !("storageBuckets" in value)) {
    return null
  }

  const buckets = (value as { storageBuckets?: unknown }).storageBuckets

  if (!Array.isArray(buckets)) {
    return null
  }

  return new Map(
    buckets
      .filter(
        (bucket): bucket is { id: string; objectCount: number } =>
          Boolean(bucket) &&
          typeof bucket === "object" &&
          typeof (bucket as { id?: unknown }).id === "string" &&
          typeof (bucket as { objectCount?: unknown }).objectCount === "number"
      )
      .map((bucket) => [bucket.id, bucket.objectCount])
  )
}

function getFinancialReconciliationCounts(value: unknown) {
  if (!value || typeof value !== "object" || !("financialReconciliation" in value)) {
    return null
  }

  const reconciliation = (value as { financialReconciliation?: { counts?: unknown } })
    .financialReconciliation

  return reconciliation?.counts && typeof reconciliation.counts === "object"
    ? reconciliation.counts
    : null
}

function mapToRows(
  map: Map<string, number> | null,
  keyName: "table" | "bucket",
  valueName: "rows" | "objects"
) {
  return map
    ? [...map.entries()].map(([key, value]) => ({
        [keyName]: key,
        [valueName]: value,
      }))
    : null
}

function sumLoss(source: Map<string, number> | null, restore: Map<string, number> | null) {
  if (!source || !restore) {
    return null
  }

  return [...source.entries()].reduce((total, [key, sourceCount]) => {
    const restoreCount = restore.get(key) ?? 0

    return total + Math.max(sourceCount - restoreCount, 0)
  }, 0)
}

function numberValue(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return null
  }

  const candidate = (value as Record<string, unknown>)[key]

  return typeof candidate === "number" ? candidate : null
}

function stableJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value)
  }

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    )
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
