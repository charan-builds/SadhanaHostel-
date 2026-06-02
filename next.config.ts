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

const nextConfig: NextConfig = {
  typedRoutes: true,
  turbopack: {
    root: process.cwd(),
  },
  redirects: publicRedirects,
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
