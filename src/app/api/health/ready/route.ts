import { NextResponse } from "next/server"

import { getServerEnv } from "@/config/env"
import { getCache, setCache } from "@/lib/cache"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type ReadinessCheck = {
  ok: boolean
  latencyMs?: number
}

export async function GET() {
  const checks = await runReadinessChecks()
  const ready = Object.values(checks).every((check) => check.ok)

  return NextResponse.json(
    {
      success: ready,
      data: {
        status: ready ? "ready" : "not_ready",
        checks,
        timestamp: new Date().toISOString(),
      },
      message: ready
        ? "Service dependencies are ready."
        : "One or more service dependencies are not ready.",
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "cache-control": "no-store",
      },
    }
  )
}

async function runReadinessChecks() {
  const env = checkEnvironment()
  const cache = checkCache()

  if (!env.ok) {
    return {
      env,
      cache,
      database: { ok: false },
      storage: { ok: false },
    }
  }

  const supabase = createSupabaseAdminClient()
  const [database, storage] = await Promise.all([
    checkDatabase(supabase),
    checkStorage(supabase),
  ])

  return {
    env,
    cache,
    database,
    storage,
  }
}

function checkEnvironment(): ReadinessCheck {
  const startedAt = Date.now()

  try {
    getServerEnv()

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    }
  } catch {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
    }
  }
}

function checkCache(): ReadinessCheck {
  const startedAt = Date.now()
  const key = "__health:ready"

  try {
    setCache(key, "ok", { ttlMs: 5_000 })

    return {
      ok: getCache<string>(key) === "ok",
      latencyMs: Date.now() - startedAt,
    }
  } catch {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
    }
  }
}

async function checkDatabase(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const startedAt = Date.now()
  const { error } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .limit(1)

  return {
    ok: !error,
    latencyMs: Date.now() - startedAt,
  }
}

async function checkStorage(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const startedAt = Date.now()
  const { error } = await supabase.storage.listBuckets()

  return {
    ok: !error,
    latencyMs: Date.now() - startedAt,
  }
}
