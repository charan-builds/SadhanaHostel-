import { execFile } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { loadEnvConfig } from "@next/env"
import { createClient } from "@supabase/supabase-js"

import {
  assertRestoreTargetIsIsolated,
  readManualDrManifest,
  storageObjectLocalPath,
} from "./manual-dr-common"

loadEnvConfig(process.cwd())

const execFileAsync = promisify(execFile)

type StorageAdminClient = {
  storage: {
    getBucket: (bucket: string) => Promise<{
      data: unknown
      error: { message: string } | null
    }>
    createBucket: (
      bucket: string,
      options: { public: boolean }
    ) => Promise<{
      data: unknown
      error: { message: string } | null
    }>
  }
}

async function main() {
  const backupDir = path.resolve(process.argv[2] ?? requiredArgument())
  const manifest = await readManualDrManifest(backupDir)
  const restoreSupabaseUrl =
    process.env.RESTORE_SUPABASE_URL ?? inferLocalSupabaseUrl(process.env.RESTORE_DATABASE_URL)
  const restoreServiceRoleKey =
    process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.RESTORE_SERVICE_ROLE_KEY ??
    (restoreSupabaseUrl && isLocalUrl(restoreSupabaseUrl) ? await readLocalServiceRoleKey() : null)

  if (!restoreSupabaseUrl || !restoreServiceRoleKey) {
    throw new Error(
      "RESTORE_SUPABASE_URL and RESTORE_SUPABASE_SERVICE_ROLE_KEY are required, or RESTORE_DATABASE_URL must point to a running local Supabase target."
    )
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL === restoreSupabaseUrl) {
    throw new Error("Restore storage target must not be the production Supabase URL.")
  }

  assertRestoreTargetIsIsolated(process.env.DATABASE_URL, process.env.RESTORE_DATABASE_URL ?? "")

  const supabase = createClient(restoreSupabaseUrl, restoreServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const startedAt = Date.now()
  const restoredBuckets = []

  for (const bucket of manifest.storage.buckets) {
    await ensureBucket(supabase, bucket.bucket, bucket.public)

    let restoredObjects = 0

    for (const object of bucket.objects) {
      const absolutePath = path.join(backupDir, object.localPath)
      const expectedPath = storageObjectLocalPath(backupDir, bucket.bucket, object.path)

      if (path.resolve(absolutePath) !== path.resolve(expectedPath)) {
        throw new Error(`Manifest localPath does not match object path for ${bucket.bucket}/${object.path}.`)
      }

      const file = await readFile(absolutePath)
      const { error } = await supabase.storage.from(bucket.bucket).upload(object.path, file, {
        upsert: true,
        contentType: object.contentType ?? "application/octet-stream",
      })

      if (error) {
        throw new Error(`Unable to restore ${bucket.bucket}/${object.path}: ${error.message}`)
      }

      restoredObjects += 1
    }

    restoredBuckets.push({
      bucket: bucket.bucket,
      restoredObjects,
    })
  }

  const report = {
    ok: true,
    restoredAt: new Date().toISOString(),
    backupName: manifest.backupName,
    restoreSupabaseHost: new URL(restoreSupabaseUrl).host,
    buckets: restoredBuckets,
    rto: {
      storageRestoreDurationMs: Date.now() - startedAt,
    },
  }

  await writeFile(
    path.join(backupDir, "manual-storage-restore-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  )

  console.log(JSON.stringify(report, null, 2))
}

async function ensureBucket(supabase: StorageAdminClient, bucket: string, isPublic: boolean) {
  const { data, error } = await supabase.storage.getBucket(bucket)

  if (!error && data) {
    return
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: isPublic,
  })

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Unable to create restore bucket ${bucket}: ${createError.message}`)
  }
}

function requiredArgument() {
  throw new Error("Usage: tsx scripts/recovery/manual-storage-restore.ts <backup-dir>")
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
