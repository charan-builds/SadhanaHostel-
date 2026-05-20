"use client"

import { createBrowserClient } from "@supabase/ssr"

import { getSupabasePublicConfig } from "@/lib/env"
import type { Database } from "@/types/database"

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicConfig()

  return createBrowserClient<Database>(url, anonKey)
}
