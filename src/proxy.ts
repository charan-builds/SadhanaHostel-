import { NextResponse, type NextRequest } from "next/server"

import {
  ADMIN_ROUTE_PREFIX,
  AUTH_REDIRECTS,
  RESIDENT_ROUTE_PREFIX,
} from "@/constants/auth"
import {
  getMaintenanceMessage,
  isMaintenanceBypassRequest,
  isMaintenanceExemptPath,
  isMaintenanceModeEnabled,
} from "@/config/launch"
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const pathname = request.nextUrl.pathname
  const pathWithSearch = `${pathname}${request.nextUrl.search}`

  requestHeaders.set("x-sadhana-pathname", pathWithSearch)

  if (
    isMaintenanceModeEnabled() &&
    !isMaintenanceExemptPath(pathname) &&
    !isMaintenanceBypassRequest(request)
  ) {
    return maintenanceResponse(request)
  }

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

function maintenanceResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MAINTENANCE_MODE",
          message: getMaintenanceMessage(),
        },
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "retry-after": "300",
        },
      }
    )
  }

  const maintenanceUrl = request.nextUrl.clone()
  maintenanceUrl.pathname = "/maintenance"
  maintenanceUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(maintenanceUrl)
}

function isProtectedPath(pathname: string) {
  if (pathname === "/admin/login" || pathname === "/resident/login") {
    return false
  }

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
