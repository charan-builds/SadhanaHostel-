import { z } from "zod"

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

export function hasSupabaseConfig() {
  return supabaseEnvSchema.safeParse(process.env).success
}

export function getSupabaseConfig() {
  const parsed = supabaseEnvSchema.safeParse(process.env)

  if (!parsed.success) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
    )
  }

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}
