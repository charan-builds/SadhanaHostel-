import { execFile } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { loadEnvConfig } from "@next/env"
import { Client } from "pg"

import {
  buildBackupName,
  backupManifestPath,
  CRITICAL_TABLES,
  downloadStorageObject,
  fileSize,
  GOOGLE_DRIVE_BACKUP_ACCOUNT,
  listBuckets,
  listObjectsRecursive,
  MANUAL_STORAGE_BUCKETS,
  optionalUrlHost,
  requiredEnv,
  sha256File,
  sha256Json,
  storageObjectLocalPath,
  toPortablePath,
  type ManualDrManifest,
  type RowCount,
  type StorageBucketManifest,
  type StorageEndpoint,
} from "./manual-dr-common"

loadEnvConfig(process.cwd())

const execFileAsync = promisify(execFile)

async function main() {
  const startedAt = Date.now()
  const databaseUrl = requiredEnv("DATABASE_URL")
  const sourceEndpoint: StorageEndpoint = {
    supabaseUrl: requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  }
  const googleDriveRemote =
    process.env.MANUAL_DR_GOOGLE_DRIVE_REMOTE ?? process.env.GOOGLE_DRIVE_BACKUP_REMOTE
  const googleDriveAccount =
    process.env.GOOGLE_DRIVE_BACKUP_ACCOUNT_EMAIL ?? GOOGLE_DRIVE_BACKUP_ACCOUNT

  if (googleDriveAccount !== GOOGLE_DRIVE_BACKUP_ACCOUNT) {
    throw new Error(
      `Google Drive backup account must be ${GOOGLE_DRIVE_BACKUP_ACCOUNT}; received ${googleDriveAccount}.`
    )
  }

  if (!googleDriveRemote) {
    throw new Error(
      "MANUAL_DR_GOOGLE_DRIVE_REMOTE or GOOGLE_DRIVE_BACKUP_REMOTE is required. Configure an rclone Google Drive remote for charanderangula007@gmail.com."
    )
  }

  await verifyRcloneGoogleDriveRemote(googleDriveRemote)

  const backupName = buildBackupName()
  const backupRoot = path.resolve(process.env.MANUAL_DR_BACKUP_ROOT ?? ".manual-dr-backups")
  const backupDir = path.join(backupRoot, backupName)
  const sqlFilename = `${backupName}.sql`
  const sqlPath = path.join(backupDir, sqlFilename)

  await mkdir(backupRoot, { recursive: true })
  await mkdir(backupDir, { recursive: false })

  const dbStartedAt = Date.now()
  await createDatabaseDump(databaseUrl, sqlPath)
  const rowCounts = await collectRowCounts(databaseUrl)
  const databaseDurationMs = Date.now() - dbStartedAt

  const storageStartedAt = Date.now()
  const storageBuckets = await createStorageBackup(sourceEndpoint, backupDir)
  const storageDurationMs = Date.now() - storageStartedAt

  const remotePath = joinRemotePath(googleDriveRemote, backupName)
  const manifest: ManualDrManifest = {
    version: 1,
    kind: "sadhana-hostel-manual-google-drive-dr-backup",
    backupName,
    backupTimestamp: new Date().toISOString(),
    backupTimezone: "UTC",
    source: {
      databaseHost: optionalUrlHost(databaseUrl),
      supabaseHost: optionalUrlHost(sourceEndpoint.supabaseUrl),
    },
    database: {
      filename: sqlFilename,
      sizeBytes: await fileSize(sqlPath),
      checksumSha256: await sha256File(sqlPath),
      durationMs: databaseDurationMs,
      rowCounts,
    },
    storage: {
      durationMs: storageDurationMs,
      buckets: storageBuckets,
    },
    googleDrive: {
      accountEmail: GOOGLE_DRIVE_BACKUP_ACCOUNT,
      remote: googleDriveRemote,
      remotePath,
      uploadedAt: null,
      uploadDurationMs: null,
      verified: false,
    },
  }

  await writeManifestFiles(backupDir, manifest)

  const uploadStartedAt = Date.now()
  await execFileAsync("rclone", ["copy", backupDir, remotePath, "--checksum"], {
    maxBuffer: 1024 * 1024 * 20,
  })
  await verifyRemoteManifest(remotePath)

  manifest.googleDrive.uploadedAt = new Date().toISOString()
  manifest.googleDrive.uploadDurationMs = Date.now() - uploadStartedAt
  manifest.googleDrive.verified = true
  await writeManifestFiles(backupDir, manifest)
  await execFileAsync("rclone", ["copy", backupManifestPath(backupDir), remotePath, "--checksum"], {
    maxBuffer: 1024 * 1024 * 20,
  })
  await execFileAsync(
    "rclone",
    ["copy", path.join(backupDir, "backup-manifest.sha256"), remotePath, "--checksum"],
    { maxBuffer: 1024 * 1024 * 20 }
  )

  const report = {
    ok: true,
    backupName,
    backupDir,
    googleDrive: manifest.googleDrive,
    database: manifest.database,
    storage: {
      durationMs: storageDurationMs,
      objectCounts: storageBuckets.map((bucket) => ({
        bucket: bucket.bucket,
        objects: bucket.objectCount,
      })),
    },
    rto: {
      backupDurationMs: Date.now() - startedAt,
    },
    rpo: {
      maximumDataLoss: "24 hours with daily scheduled execution",
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

async function writeManifestFiles(backupDir: string, manifest: ManualDrManifest) {
  await writeFile(backupManifestPath(backupDir), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(
    path.join(backupDir, "backup-manifest.sha256"),
    `${sha256Json(manifest)}  backup-manifest.json\n`
  )
}

async function createDatabaseDump(databaseUrl: string, sqlPath: string) {
  try {
    await execFileAsync(
      "pg_dump",
      [
        "--format=plain",
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "--schema=public",
        "--file",
        sqlPath,
        databaseUrl,
      ],
      { maxBuffer: 1024 * 1024 * 100 }
    )
  } catch (error) {
    throw new Error(`pg_dump failed: ${redactSecrets(formatChildProcessError(error))}`)
  }
}

async function collectRowCounts(databaseUrl: string): Promise<RowCount[]> {
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

async function createStorageBackup(endpoint: StorageEndpoint, backupDir: string) {
  const buckets = await listBuckets(endpoint)
  const bucketMap = new Map(buckets.map((bucket) => [bucket.id, bucket]))
  const manifests: StorageBucketManifest[] = []

  for (const bucket of MANUAL_STORAGE_BUCKETS) {
    const bucketMetadata = bucketMap.get(bucket)

    if (!bucketMetadata) {
      throw new Error(`Source storage bucket ${bucket} does not exist.`)
    }

    const objects = await listObjectsRecursive(endpoint, bucket)
    const objectManifests = []

    for (const object of objects) {
      const localPath = storageObjectLocalPath(backupDir, bucket, object.path)
      const download = await downloadStorageObject(endpoint, bucket, object.path)

      await mkdir(path.dirname(localPath), { recursive: true })
      await writeFile(localPath, download.buffer)

      objectManifests.push({
        path: object.path,
        localPath: toPortablePath(path.relative(backupDir, localPath)),
        sizeBytes: download.buffer.byteLength,
        checksumSha256: await sha256File(localPath),
        contentType: download.contentType,
      })
    }

    manifests.push({
      bucket,
      public: bucketMetadata.public,
      objectCount: objectManifests.length,
      checksumSha256: sha256Json(objectManifests.map((object) => object.checksumSha256)),
      objects: objectManifests,
    })
  }

  return manifests
}

async function verifyRcloneGoogleDriveRemote(remote: string) {
  const remoteName = remote.split(":")[0]

  if (!remoteName || remoteName === remote) {
    throw new Error(
      "Google Drive destination must be an rclone remote path such as gdrive:sadhana-hostel-dr."
    )
  }

  await execFileAsync("rclone", ["version"], { maxBuffer: 1024 * 1024 })
  const { stdout } = await execFileAsync("rclone", ["config", "show", remoteName], {
    maxBuffer: 1024 * 1024,
  })

  if (!/type\s*=\s*drive/.test(stdout)) {
    throw new Error(`${remoteName} is not configured as an rclone Google Drive remote.`)
  }
}

async function verifyRemoteManifest(remotePath: string) {
  const { stdout } = await execFileAsync("rclone", ["lsf", remotePath, "--files-only"], {
    maxBuffer: 1024 * 1024,
  })
  const files = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (!files.includes("backup-manifest.json")) {
    throw new Error(`Google Drive backup verification failed for ${remotePath}.`)
  }
}

function joinRemotePath(remote: string, backupName: string) {
  return `${remote.replace(/\/$/, "")}/${backupName}`
}

function formatChildProcessError(error: unknown) {
  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown
      stderr?: unknown
      stdout?: unknown
    }
    const parts = [maybeError.message, maybeError.stderr, maybeError.stdout]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)

    if (parts.length > 0) {
      return parts.join("\n")
    }
  }

  return error instanceof Error ? error.message : String(error)
}

function redactSecrets(value: string) {
  const knownSecrets = [
    process.env.DATABASE_URL,
    process.env.RESTORE_DATABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY,
    process.env.RESTORE_SERVICE_ROLE_KEY,
  ].filter((secret): secret is string => Boolean(secret))

  let redacted = value

  for (const secret of knownSecrets) {
    redacted = redacted.split(secret).join("[redacted]")
  }

  return redacted.replace(
    /(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s]+(@[^\s]+)/gi,
    "$1[redacted]$2"
  )
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)

  console.error(redactSecrets(message))
  process.exit(1)
})
