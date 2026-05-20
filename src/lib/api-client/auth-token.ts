import { createSupabaseBrowserClient } from "@/lib/supabase/client"

let inFlightToken: Promise<string | null> | null = null

export async function getCurrentAccessToken() {
  if (typeof window === "undefined") {
    return null
  }

  inFlightToken ??= loadCurrentAccessToken().finally(() => {
    inFlightToken = null
  })

  return inFlightToken
}

async function loadCurrentAccessToken() {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    return null
  }

  return data.session?.access_token ?? null
}
