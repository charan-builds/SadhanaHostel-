import type { NextResponse } from "next/server"

import { errorResponse } from "@/lib/api/api-response"
import {
  assertRateLimit,
  getClientIp,
  type RateLimitPolicy,
  type RateLimitScope,
} from "@/lib/rate-limit"
import {
  generateRequestId,
  runWithRequestContext,
} from "@/lib/tracing"
import { logRequestEnd, logRequestStart } from "@/lib/logger"

type ApiRouteOptions = {
  route: string
  rateLimit?: RateLimitPolicy
  rateLimitScope?: RateLimitScope
}

type RouteResponse = Response | NextResponse

export async function withApiRoute(
  request: Request,
  options: ApiRouteOptions,
  handler: () => Promise<RouteResponse>
) {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()
  const url = new URL(request.url)
  const startedAt = Date.now()

  return runWithRequestContext(
    {
      requestId,
      route: options.route,
      method: request.method,
      path: url.pathname,
      startedAt,
    },
    async () => {
      logRequestStart({
        requestId,
        route: options.route,
        method: request.method,
        path: url.pathname,
        ip: getClientIp(request),
      })

      try {
        if (options.rateLimit) {
          assertRateLimit(request, options.rateLimit, options.rateLimitScope)
        }

        const response = await handler()
        response.headers.set("x-request-id", requestId)

        logRequestEnd({
          requestId,
          route: options.route,
          method: request.method,
          path: url.pathname,
          status: response.status,
          durationMs: Date.now() - startedAt,
        })

        return response
      } catch (error) {
        const response = errorResponse(error)
        response.headers.set("x-request-id", requestId)

        logRequestEnd({
          requestId,
          route: options.route,
          method: request.method,
          path: url.pathname,
          status: response.status,
          durationMs: Date.now() - startedAt,
        })

        return response
      }
    }
  )
}
