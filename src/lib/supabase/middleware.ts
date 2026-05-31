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
    error,
  } = await supabase.auth.getUser()

  if (isMissingRefreshTokenError(error)) {
    clearSupabaseAuthCookies(request, response)

    return {
      response,
      supabase,
      user: null,
    }
  }

  return {
    response,
    supabase,
    user,
  }
}

function isMissingRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const code = "code" in error ? error.code : undefined
  const message = "message" in error ? error.message : undefined

  return (
    code === "refresh_token_not_found" ||
    (typeof message === "string" &&
      message.toLowerCase().includes("refresh token not found"))
  )
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach((cookie) => {
    if (!cookie.name.startsWith("sb-")) {
      return
    }

    request.cookies.delete(cookie.name)
    response.cookies.delete(cookie.name)
  })
}
