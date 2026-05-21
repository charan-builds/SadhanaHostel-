import { NextResponse, type NextRequest } from "next/server"

import {
  ADMIN_ROUTE_PREFIX,
  AUTH_REDIRECTS,
  RESIDENT_ROUTE_PREFIX,
} from "@/constants/auth"
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const pathname = request.nextUrl.pathname
  const pathWithSearch = `${pathname}${request.nextUrl.search}`

  requestHeaders.set("x-sadhana-pathname", pathWithSearch)

  const { response, user } = await updateSession(request, requestHeaders)

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = AUTH_REDIRECTS.login
    loginUrl.searchParams.set("next", pathWithSearch)

    const redirectResponse = NextResponse.redirect(loginUrl)

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  return response
}

function isProtectedPath(pathname: string) {
  return (
    pathname === ADMIN_ROUTE_PREFIX ||
    pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`) ||
    pathname === RESIDENT_ROUTE_PREFIX ||
    pathname.startsWith(`${RESIDENT_ROUTE_PREFIX}/`)
  )
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
