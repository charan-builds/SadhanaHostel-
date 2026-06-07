import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

import { publicRedirects } from "./src/config/public-redirects"

const hasSentryBuildCredentials = Boolean(
  process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT &&
    process.env.SENTRY_AUTH_TOKEN
)
const shouldUploadSentrySourceMaps =
  process.env.SENTRY_UPLOAD_SOURCE_MAPS === "true" && hasSentryBuildCredentials
const supabaseOrigin = resolveOrigin(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "https://*.supabase.co"
)
const isDevelopment = process.env.NODE_ENV === "development"
const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
  "https://www.googletagmanager.com",
  "https://translate.google.com",
  "https://translate.googleapis.com",
  "https://translate-pa.googleapis.com",
].join(" ")
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'self' https://www.google.com https://maps.google.com https://translate.google.com",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
  scriptSrc,
  `connect-src 'self' ${supabaseOrigin} wss://*.supabase.co https:`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ")

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  redirects: publicRedirects,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/favicon.ico",
          destination: "/icon",
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; connect-src 'self' https:; img-src 'self' data: https:",
          },
        ],
      },
      {
        source: "/:path*{/}?",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: shouldUploadSentrySourceMaps,
  sourcemaps: {
    disable: !shouldUploadSentrySourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    create: shouldUploadSentrySourceMaps,
    finalize: shouldUploadSentrySourceMaps,
    deploy: process.env.SENTRY_ENVIRONMENT
      ? { env: process.env.SENTRY_ENVIRONMENT }
      : undefined,
  },
  webpack: {
    automaticVercelMonitors: shouldUploadSentrySourceMaps,
    treeshake: {
      removeDebugLogging: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
    },
  },
})

function resolveOrigin(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback
  }

  try {
    return new URL(value).origin
  } catch {
    return fallback
  }
}
