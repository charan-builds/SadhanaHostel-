import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

export const CRITICAL_TABLES = [
  "organizations",
  "hostels",
  "residents",
  "monthly_fee_records",
  "invoices",
  "payments",
  "documents",
] as const

export const MANUAL_STORAGE_BUCKETS = [
  "payment-screenshots",
  "payment-qr-codes",
  "invoices",
  "gallery-images",
] as const

export const GOOGLE_DRIVE_BACKUP_ACCOUNT = "charanderangula007@gmail.com"

export type CriticalTable = (typeof CRITICAL_TABLES)[number]
export type ManualStorageBucket = (typeof MANUAL_STORAGE_BUCKETS)[number]

export type RowCount = {
  table: CriticalTable
  rows: number
}

export type StorageObjectManifest = {
  path: string
  localPath: string
  sizeBytes: number
  checksumSha256: string
  contentType: string | null
}

export type StorageBucketManifest = {
  bucket: ManualStorageBucket
  public: boolean
  objectCount: number
  checksumSha256: string
  objects: StorageObjectManifest[]
}

export type ManualDrManifest = {
  version: 1
  kind: "sadhana-hostel-manual-google-drive-dr-backup"
  backupName: string
  backupTimestamp: string
  backupTimezone: "UTC"
  source: {
    databaseHost: string | null
    supabaseHost: string | null
  }
  database: {
    filename: string
    sizeBytes: number
    checksumSha256: string
    durationMs: number
    rowCounts: RowCount[]
  }
  storage: {
    durationMs: number
    buckets: StorageBucketManifest[]
  }
  googleDrive: {
    accountEmail: string
    remote: string
    remotePath: string
    uploadedAt: string | null
    uploadDurationMs: number | null
    verified: boolean
  }
}

export type StorageEndpoint = {
  supabaseUrl: string
  serviceRoleKey: string
}

export type ListedStorageObject = {
  path: string
}

type StorageListItem = {
  id: string | null
  name: string
}

export function formatBackupTimestamp(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  const hour = pad(date.getUTCHours())
  const minute = pad(date.getUTCMinutes())

  return `${year}-${month}-${day}-${hour}${minute}`
}

export function buildBackupName(date = new Date()) {
  return `backup-${formatBackupTimestamp(date)}`
}

export function requiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

export function optionalUrlHost(value?: string) {
  if (!value) {
    return null
  }

  try {
    return new URL(value).host
  } catch {
    return null
  }
}

export function backupManifestPath(backupDir: string) {
  return path.join(backupDir, "backup-manifest.json")
}

export async function readManualDrManifest(backupDir: string): Promise<ManualDrManifest> {
  const content = await readFile(backupManifestPath(backupDir), "utf8")
  const parsed: unknown = JSON.parse(content)

  if (!isManualDrManifest(parsed)) {
    throw new Error(`Invalid manual DR manifest at ${backupManifestPath(backupDir)}.`)
  }

  return parsed
}

export function storageObjectLocalPath(backupDir: string, bucket: string, objectPath: string) {
  const bucketRoot = path.resolve(backupDir, "storage", encodePathSegment(bucket))
  const encodedSegments = objectPath.split("/").map(encodePathSegment)
  const fullPath = path.resolve(bucketRoot, ...encodedSegments)

  if (!fullPath.startsWith(`${bucketRoot}${path.sep}`) && fullPath !== bucketRoot) {
    throw new Error(`Unsafe storage object path: ${objectPath}`)
  }

  return fullPath
}

export function toPortablePath(value: string) {
  return value.split(path.sep).join("/")
}

export async function sha256File(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256")
    const stream = createReadStream(filePath)

    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(hash.digest("hex")))
  })
}

export function sha256Json(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex")
}

export async function fileSize(filePath: string) {
  return (await stat(filePath)).size
}

export function storageHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function listBuckets(endpoint: StorageEndpoint) {
  const response = await fetch(`${trimSlash(endpoint.supabaseUrl)}/storage/v1/bucket`, {
    headers: storageHeaders(endpoint.serviceRoleKey),
  })
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok || !Array.isArray(body)) {
    throw new Error(`Unable to list storage buckets: ${JSON.stringify(body)}`)
  }

  return body
    .filter(
      (bucket): bucket is { id: string; public: boolean } =>
        Boolean(bucket) &&
        typeof bucket === "object" &&
        typeof (bucket as { id?: unknown }).id === "string" &&
        typeof (bucket as { public?: unknown }).public === "boolean"
    )
    .map((bucket) => ({ id: bucket.id, public: bucket.public }))
}

export async function listObjectsRecursive(
  endpoint: StorageEndpoint,
  bucket: string,
  prefix = ""
): Promise<ListedStorageObject[]> {
  const objects: ListedStorageObject[] = []
  let offset = 0

  while (true) {
    const response = await fetch(
      `${trimSlash(endpoint.supabaseUrl)}/storage/v1/object/list/${bucket}`,
      {
        method: "POST",
        headers: storageHeaders(endpoint.serviceRoleKey),
        body: JSON.stringify({
          limit: 100,
          offset,
          prefix,
          sortBy: { column: "name", order: "asc" },
        }),
      }
    )
    const body: unknown = await response.json().catch(() => null)

    if (!response.ok || !Array.isArray(body)) {
      throw new Error(`Unable to list ${bucket}/${prefix}: ${JSON.stringify(body)}`)
    }

    if (body.length === 0) {
      break
    }

    for (const item of body) {
      const parsed = parseStorageListItem(item)

      if (!parsed) {
        continue
      }

      const objectPath = prefix ? `${prefix}/${parsed.name}` : parsed.name

      if (parsed.id) {
        objects.push({ path: objectPath })
      } else {
        objects.push(...(await listObjectsRecursive(endpoint, bucket, objectPath)))
      }
    }

    if (body.length < 100) {
      break
    }

    offset += body.length
  }

  return objects
}

export async function downloadStorageObject(
  endpoint: StorageEndpoint,
  bucket: string,
  objectPath: string
) {
  const response = await fetch(
    `${trimSlash(endpoint.supabaseUrl)}/storage/v1/object/${bucket}/${encodeStorageObjectPath(
      objectPath
    )}`,
    {
      headers: {
        apikey: endpoint.serviceRoleKey,
        Authorization: `Bearer ${endpoint.serviceRoleKey}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(
      `Unable to download ${bucket}/${objectPath}: ${response.status} ${await response.text()}`
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  return {
    buffer,
    contentType: response.headers.get("content-type"),
  }
}

export async function createSignedUrl(
  endpoint: StorageEndpoint,
  bucket: string,
  objectPath: string
) {
  const response = await fetch(
    `${trimSlash(endpoint.supabaseUrl)}/storage/v1/object/sign/${bucket}/${encodeStorageObjectPath(
      objectPath
    )}`,
    {
      method: "POST",
      headers: storageHeaders(endpoint.serviceRoleKey),
      body: JSON.stringify({ expiresIn: 60 }),
    }
  )
  const body: unknown = await response.json().catch(() => null)
  const signedUrl = extractSignedUrl(body)

  return response.ok && signedUrl
    ? normalizeSignedUrl(endpoint.supabaseUrl, signedUrl)
    : null
}

export async function verifySignedUrlAccess(url: string) {
  const response = await fetch(url, {
    headers: {
      Range: "bytes=0-0",
    },
  })

  await response.arrayBuffer().catch(() => null)

  return response.ok || response.status === 206
}

export function assertRestoreTargetIsIsolated(sourceUrl: string | undefined, restoreUrl: string) {
  if (sourceUrl && sourceUrl === restoreUrl) {
    throw new Error("RESTORE_DATABASE_URL must not equal DATABASE_URL.")
  }
}

export async function ensureParentDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true })
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value || "_")
}

function encodeStorageObjectPath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/")
}

function trimSlash(value: string) {
  return value.replace(/\/$/, "")
}

function parseStorageListItem(value: unknown): StorageListItem | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const candidate = value as { id?: unknown; name?: unknown }

  if (typeof candidate.name !== "string") {
    return null
  }

  return {
    id: typeof candidate.id === "string" ? candidate.id : null,
    name: candidate.name,
  }
}

function extractSignedUrl(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  const body = value as { signedURL?: unknown; signedUrl?: unknown }
  const signedUrl = body.signedURL ?? body.signedUrl

  return typeof signedUrl === "string" ? signedUrl : null
}

function normalizeSignedUrl(supabaseUrl: string, signedUrl: string) {
  if (signedUrl.startsWith("http")) {
    return signedUrl
  }

  if (signedUrl.startsWith("/storage/v1/")) {
    return new URL(signedUrl, supabaseUrl).toString()
  }

  if (signedUrl.startsWith("/object/")) {
    return `${trimSlash(supabaseUrl)}/storage/v1${signedUrl}`
  }

  return new URL(signedUrl, supabaseUrl).toString()
}

function isManualDrManifest(value: unknown): value is ManualDrManifest {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as { version?: unknown; kind?: unknown; backupName?: unknown }

  return (
    candidate.version === 1 &&
    candidate.kind === "sadhana-hostel-manual-google-drive-dr-backup" &&
    typeof candidate.backupName === "string"
  )
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
