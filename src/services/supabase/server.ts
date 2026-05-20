import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabaseConfig } from "@/lib/env"
import type { Database } from "@/types/database"

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseConfig()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components can read cookies but cannot write them.
        }
      },
    },
  })
}
