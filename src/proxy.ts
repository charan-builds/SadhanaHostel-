import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"
import {
  buildAuthRedirect,
  getEffectiveRoles,
  getProtectedRoutePolicy,
  hasAllowedRole,
} from "@/middleware/auth"

function redirectWithSessionCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
  redirectUrl: URL
) {
  const redirectResponse = NextResponse.redirect(redirectUrl)

  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie)
  })

  request.cookies.getAll().forEach((cookie) => {
    if (!redirectResponse.cookies.has(cookie.name)) {
      redirectResponse.cookies.set(cookie)
    }
  })

  return redirectResponse
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const policy = getProtectedRoutePolicy(pathname)
  const { response, supabase, user } = await updateSession(request)

  if (!policy) {
    return response
  }

  if (!user) {
    return redirectWithSessionCookies(
      request,
      response,
      buildAuthRedirect(request.url, pathname, policy.loginPath, "login_required")
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("default_role,organization_id,is_active,deleted_at")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile || !profile.is_active || profile.deleted_at) {
    return redirectWithSessionCookies(
      request,
      response,
      buildAuthRedirect(request.url, pathname, policy.loginPath, "inactive_profile")
    )
  }

  const { data: roleAssignments, error: rolesError } = await supabase
    .from("user_roles")
    .select("role,organization_id,hostel_id,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)

  if (rolesError) {
    return redirectWithSessionCookies(
      request,
      response,
      buildAuthRedirect(request.url, pathname, policy.loginPath, "role_lookup_failed")
    )
  }

  const roles = getEffectiveRoles(profile, roleAssignments ?? [])

  if (!hasAllowedRole(roles, policy.allowedRoles)) {
    return redirectWithSessionCookies(
      request,
      response,
      buildAuthRedirect(
        request.url,
        pathname,
        policy.unauthorizedPath,
        `${policy.area}_role_required`
      )
    )
  }

  return response
}

export const config = {
  matcher: ["/admin/:path*", "/resident/:path*"],
}
