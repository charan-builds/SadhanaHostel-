import { getPublicEnv, isPlaceholderEnvValue, type PublicEnv } from "@/config/env"

type SupabasePublicConfig = Pick<
  PublicEnv,
  "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
>

function isUsableSupabaseConfig(env: SupabasePublicConfig) {
  const values = [env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY]

  return values.every(
    (value) =>
      value.trim().length > 0 &&
      !isPlaceholderEnvValue(value)
  )
}

export function hasSupabaseConfig() {
  try {
    return isUsableSupabaseConfig(getPublicEnv())
  } catch {
    return false
  }
}

export function getSupabaseConfig() {
  const env = getPublicEnv()

  if (!isUsableSupabaseConfig(env)) {
    throw new Error(
      "Invalid public environment configuration: Supabase URL/key are missing or still use placeholder values. Create .env.local with real Supabase project values."
    )
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export const getSupabasePublicConfig = getSupabaseConfig
