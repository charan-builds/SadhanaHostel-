import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { getSupabasePublicConfig, hasSupabaseConfig } from "@/lib/env"
import type { Database } from "@/types/database"

export async function updateSession(
  request: NextRequest,
  requestHeaders = new Headers(request.headers)
) {
  if (!hasSupabaseConfig()) {
    if (process.env.NODE_ENV === "production") {
      getSupabasePublicConfig()
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    response.headers.set("x-sadhana-auth", "supabase-config-missing")

    return {
      response,
      supabase: null,
      user: null,
    }
  }

  const { url, anonKey } = getSupabasePublicConfig()

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return {
    response,
    supabase,
    user,
  }
}
