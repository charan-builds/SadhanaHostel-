import "server-only"

import { createClient } from "@supabase/supabase-js"

import { getSupabaseAdminConfig } from "@/lib/server-env"
import type { Database } from "@/types/database"

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig()

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "sadhana-hostel-admin",
      },
    },
  })
}
