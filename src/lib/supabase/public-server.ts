import "server-only"

import { createClient } from "@supabase/supabase-js"

import { getSupabasePublicConfig } from "@/lib/env"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Database } from "@/types/database"

export function createSupabasePublicServerClient(): AppSupabaseClient {
  const { url, anonKey } = getSupabasePublicConfig()

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "sadhana-hostel-public-server",
      },
    },
  }) as AppSupabaseClient
}
