import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

const hasSentryBuildCredentials = Boolean(
  process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT &&
    process.env.SENTRY_AUTH_TOKEN
)

const nextConfig: NextConfig = {
  typedRoutes: true,
  turbopack: {
    root: process.cwd(),
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: hasSentryBuildCredentials,
  sourcemaps: {
    disable: !hasSentryBuildCredentials,
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    create: hasSentryBuildCredentials,
    finalize: hasSentryBuildCredentials,
    deploy: process.env.SENTRY_ENVIRONMENT
      ? { env: process.env.SENTRY_ENVIRONMENT }
      : undefined,
  },
  webpack: {
    automaticVercelMonitors: hasSentryBuildCredentials,
    treeshake: {
      removeDebugLogging: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
    },
  },
})
