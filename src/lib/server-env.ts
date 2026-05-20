import "server-only"

import { getServerEnv } from "@/config/env"

export function getSupabaseAdminConfig() {
  const env = getServerEnv()

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  }
}
