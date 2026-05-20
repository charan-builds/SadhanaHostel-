import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabasePublicConfig } from "@/lib/env"
import type { Database } from "@/types/database"

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabasePublicConfig()
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
          // Server Components can read cookies but cannot persist refreshed tokens.
          // Route Handlers, Server Actions, and Proxy can write refreshed cookies.
        }
      },
    },
  })
}
