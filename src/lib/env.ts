import { getPublicEnv } from "@/config/env"

export function hasSupabaseConfig() {
  try {
    getPublicEnv()
    return true
  } catch {
    return false
  }
}

export function getSupabaseConfig() {
  const env = getPublicEnv()

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export const getSupabasePublicConfig = getSupabaseConfig
