import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { loadEnvConfig } from "@next/env"

loadEnvConfig(process.cwd())

const execFileAsync = promisify(execFile)

const STORAGE_BUCKETS = [
  "resident-documents",
  "payment-screenshots",
  "payment-qr-codes",
  "invoices",
  "gallery-images",
] as const

type Blocker = {
  id: string
  detail: string
  requiredCredential?: string
  source?: string
}

type StorageEndpoint = {
  label: "source" | "restore"
  supabaseUrl: string
  serviceRoleKey: string
  credentialSource: string
}

type BucketEvidence = {
  id: string
  exists: boolean
  public: boolean | null
  objectCount: number | null
  samplePath: string | null
  signedUrlGenerated: boolean | null
  signedUrlAccessible: boolean | null
  accessibilityStatus: number | null
  contentType: string | null
  error?: string
}

async function main() {
  const startedAt = Date.now()
  const blockers: Blocker[] = []
  const sourceEndpoint = await resolveSourceEndpoint(blockers)
  const restoreEndpoint = await resolveRestoreEndpoint(blockers)
  const source = sourceEndpoint
    ? await collectStorageEvidence(sourceEndpoint, blockers)
    : { ok: false, buckets: [] as BucketEvidence[] }
  const restore = restoreEndpoint
    ? await collectStorageEvidence(restoreEndpoint, blockers)
    : { ok: false, buckets: [] as BucketEvidence[] }

  compareStorageCounts(source.buckets, restore.buckets, blockers)
  verifySpecialBucketAccess("invoices", "invoice PDF", source.buckets, restore.buckets, blockers)
  verifySpecialBucketAccess(
    "payment-screenshots",
    "payment screenshot",
    source.buckets,
    restore.buckets,
    blockers
  )

  const report = {
    checkedAt: new Date().toISOString(),
    source,
    restore,
    rto: {
      storageValidationDurationMs: Date.now() - startedAt,
    },
    rpo: {
      objectLoss: calculateObjectLoss(source.buckets, restore.buckets),
    },
    blockers,
  }

  console.log(JSON.stringify(report, null, 2))

  if (blockers.length > 0) {
    process.exitCode = 1
  }
}

async function resolveSourceEndpoint(blockers: Blocker[]): Promise<StorageEndpoint | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    blockers.push({
      id: "source-storage-credentials-missing",
      detail: "Source storage validation requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      requiredCredential: "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      source: "Production Supabase project API settings",
    })
    return null
  }

  return {
    label: "source",
    supabaseUrl,
    serviceRoleKey,
    credentialSource: "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY",
  }
}

async function resolveRestoreEndpoint(blockers: Blocker[]): Promise<StorageEndpoint | null> {
  const supabaseUrl =
    process.env.RESTORE_SUPABASE_URL ??
    process.env.TEST_SUPABASE_URL ??
    inferLocalSupabaseUrl(process.env.RESTORE_DATABASE_URL)
  const serviceRoleKey =
    process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.RESTORE_SERVICE_ROLE_KEY ??
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.TEST_SERVICE_ROLE_KEY ??
    (supabaseUrl && isLocalUrl(supabaseUrl) ? await readLocalServiceRoleKey() : null)

  if (!supabaseUrl || !serviceRoleKey) {
    blockers.push({
      id: "restore-storage-credentials-missing",
      detail:
        "Restore storage validation requires RESTORE_SUPABASE_URL and RESTORE_SUPABASE_SERVICE_ROLE_KEY, or a running local Supabase restore target.",
      requiredCredential:
        "RESTORE_SUPABASE_URL and RESTORE_SUPABASE_SERVICE_ROLE_KEY for the isolated restore project",
      source: "Restored Supabase project API settings",
    })
    return null
  }

  return {
    label: "restore",
    supabaseUrl,
    serviceRoleKey,
    credentialSource: isLocalUrl(supabaseUrl)
      ? "local supabase status"
      : "RESTORE_SUPABASE_URL/RESTORE_SUPABASE_SERVICE_ROLE_KEY",
  }
}

async function collectStorageEvidence(endpoint: StorageEndpoint, blockers: Blocker[]) {
  const bucketsResponse = await fetch(`${endpoint.supabaseUrl}/storage/v1/bucket`, {
    headers: storageHeaders(endpoint.serviceRoleKey),
  })
  const bucketBody = await bucketsResponse.json().catch(() => null)

  if (!bucketsResponse.ok || !Array.isArray(bucketBody)) {
    blockers.push({
      id: `${endpoint.label}-storage-bucket-list-failed`,
      detail: JSON.stringify(bucketBody),
      requiredCredential: `${endpoint.label} service-role storage access`,
      source: `${endpoint.label} Supabase Storage API`,
    })

    return {
      ok: false,
      endpoint: publicEndpoint(endpoint),
      buckets: [] as BucketEvidence[],
    }
  }

  const bucketMap = new Map<string, { id: string; public: boolean }>(
    bucketBody.map((bucket: { id: string; public: boolean }) => [bucket.id, bucket])
  )
  const buckets = await Promise.all(
    STORAGE_BUCKETS.map(async (bucketId): Promise<BucketEvidence> => {
      const bucket = bucketMap.get(bucketId)

      if (!bucket) {
        blockers.push({
          id: `${endpoint.label}-storage-bucket-${bucketId}-missing`,
          detail: `Expected ${endpoint.label} storage bucket ${bucketId} is missing.`,
          source: `${endpoint.label} Supabase Storage`,
        })

        return {
          id: bucketId,
          exists: false,
          public: null,
          objectCount: null,
          samplePath: null,
          signedUrlGenerated: null,
          signedUrlAccessible: null,
          accessibilityStatus: null,
          contentType: null,
        }
      }

      const objectEvidence = await listObjectsRecursive(
        endpoint.supabaseUrl,
        endpoint.serviceRoleKey,
        bucketId
      )

      if (objectEvidence.error) {
        blockers.push({
          id: `${endpoint.label}-storage-object-list-failed-${bucketId}`,
          detail: objectEvidence.error,
          source: `${endpoint.label} Supabase Storage API`,
        })
      }

      if (!objectEvidence.samplePath) {
        return {
          id: bucketId,
          exists: true,
          public: bucket.public,
          objectCount: objectEvidence.objectCount,
          samplePath: null,
          signedUrlGenerated: null,
          signedUrlAccessible: null,
          accessibilityStatus: null,
          contentType: null,
          error: objectEvidence.error,
        }
      }

      const signedUrl = await createSignedUrl(
        endpoint.supabaseUrl,
        endpoint.serviceRoleKey,
        bucketId,
        objectEvidence.samplePath
      )
      const accessibility = signedUrl.url
        ? await verifySignedUrlAccess(signedUrl.url)
        : { ok: false, status: null, contentType: null }

      if (!signedUrl.ok) {
        blockers.push({
          id: `${endpoint.label}-storage-signed-url-failed-${bucketId}`,
          detail: `Unable to generate signed URL for ${endpoint.label} bucket ${bucketId} sample ${objectEvidence.samplePath}.`,
          source: `${endpoint.label} Supabase Storage API`,
        })
      }

      if (signedUrl.ok && !accessibility.ok) {
        blockers.push({
          id: `${endpoint.label}-storage-signed-url-inaccessible-${bucketId}`,
          detail: `Signed URL for ${endpoint.label} bucket ${bucketId} sample ${objectEvidence.samplePath} returned status ${accessibility.status ?? "unknown"}.`,
          source: `${endpoint.label} Supabase Storage API`,
        })
      }

      return {
        id: bucketId,
        exists: true,
        public: bucket.public,
        objectCount: objectEvidence.objectCount,
        samplePath: objectEvidence.samplePath,
        signedUrlGenerated: signedUrl.ok,
        signedUrlAccessible: accessibility.ok,
        accessibilityStatus: accessibility.status,
        contentType: accessibility.contentType,
        error: objectEvidence.error,
      }
    })
  )

  return {
    ok: buckets.every(
      (bucket) =>
        bucket.exists &&
        bucket.objectCount !== null &&
        bucket.signedUrlGenerated !== false &&
        bucket.signedUrlAccessible !== false
    ),
    endpoint: publicEndpoint(endpoint),
    buckets,
  }
}

async function listObjectsRecursive(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucketId: string,
  prefix = ""
): Promise<{ objectCount: number; samplePath: string | null; error?: string }> {
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

    if (!response.ok) {
      return {
        objectCount,
        samplePath,
        error: JSON.stringify(objects),
      }
    }

    if (!Array.isArray(objects) || objects.length === 0) {
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

        if (child.error) {
          return { objectCount, samplePath, error: child.error }
        }
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
  const signedUrl = body?.signedURL ?? body?.signedUrl

  return {
    ok: response.ok && typeof signedUrl === "string",
    url: typeof signedUrl === "string" ? normalizeSignedUrl(supabaseUrl, signedUrl) : null,
  }
}

function normalizeSignedUrl(supabaseUrl: string, signedUrl: string) {
  if (signedUrl.startsWith("http")) {
    return signedUrl
  }

  if (signedUrl.startsWith("/storage/v1/")) {
    return new URL(signedUrl, supabaseUrl).toString()
  }

  if (signedUrl.startsWith("/object/")) {
    return `${supabaseUrl.replace(/\/$/, "")}/storage/v1${signedUrl}`
  }

  return new URL(signedUrl, supabaseUrl).toString()
}

async function verifySignedUrlAccess(url: string) {
  const response = await fetch(url, {
    headers: {
      Range: "bytes=0-0",
    },
  })

  await response.arrayBuffer().catch(() => null)

  return {
    ok: response.ok || response.status === 206,
    status: response.status,
    contentType: response.headers.get("content-type"),
  }
}

function compareStorageCounts(
  sourceBuckets: BucketEvidence[],
  restoreBuckets: BucketEvidence[],
  blockers: Blocker[]
) {
  const sourceMap = bucketMap(sourceBuckets)
  const restoreMap = bucketMap(restoreBuckets)
  const mismatches = STORAGE_BUCKETS.flatMap((bucketId) => {
    const sourceCount = sourceMap.get(bucketId)?.objectCount
    const restoreCount = restoreMap.get(bucketId)?.objectCount

    return sourceCount === restoreCount
      ? []
      : [`${bucketId}: source=${sourceCount ?? "unavailable"}, restore=${restoreCount ?? "unavailable"}`]
  })

  if (mismatches.length > 0) {
    blockers.push({
      id: "storage-object-count-mismatch",
      detail: `Storage object counts differ between source and restore target. ${mismatches.join("; ")}.`,
      requiredCredential: "A restored Storage API target with copied objects",
      source: "Source and restore Supabase Storage",
    })
  }
}

function verifySpecialBucketAccess(
  bucketId: (typeof STORAGE_BUCKETS)[number],
  label: string,
  sourceBuckets: BucketEvidence[],
  restoreBuckets: BucketEvidence[],
  blockers: Blocker[]
) {
  const sourceBucket = bucketMap(sourceBuckets).get(bucketId)
  const restoreBucket = bucketMap(restoreBuckets).get(bucketId)

  for (const [side, bucket] of [
    ["source", sourceBucket],
    ["restore", restoreBucket],
  ] as const) {
    if (!bucket || bucket.objectCount === null || bucket.objectCount === 0) {
      continue
    }

    if (!bucket.signedUrlAccessible) {
      blockers.push({
        id: `${side}-${bucketId}-accessibility-failed`,
        detail: `${side} ${label} sample in bucket ${bucketId} was not accessible through a signed URL.`,
        source: `${side} Supabase Storage`,
      })
    }
  }
}

function calculateObjectLoss(sourceBuckets: BucketEvidence[], restoreBuckets: BucketEvidence[]) {
  const restoreMap = bucketMap(restoreBuckets)

  return sourceBuckets.reduce((total, sourceBucket) => {
    const sourceCount = sourceBucket.objectCount ?? 0
    const restoreCount = restoreMap.get(sourceBucket.id)?.objectCount ?? 0

    return total + Math.max(sourceCount - restoreCount, 0)
  }, 0)
}

function bucketMap(buckets: BucketEvidence[]) {
  return new Map(buckets.map((bucket) => [bucket.id, bucket]))
}

function storageHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

function publicEndpoint(endpoint: StorageEndpoint) {
  return {
    label: endpoint.label,
    supabaseUrl: endpoint.supabaseUrl,
    credentialSource: endpoint.credentialSource,
  }
}

function inferLocalSupabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) {
    return null
  }

  try {
    const url = new URL(databaseUrl)

    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return "http://127.0.0.1:54321"
    }
  } catch {
    return null
  }

  return null
}

function isLocalUrl(value: string) {
  try {
    const url = new URL(value)

    return url.hostname === "127.0.0.1" || url.hostname === "localhost"
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

  return (
    result.stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("SERVICE_ROLE_KEY="))
      ?.slice("SERVICE_ROLE_KEY=".length) ?? null
  )?.replace(/^"|"$/g, "")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
