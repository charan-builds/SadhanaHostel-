const isSentryClientEnabled =
  process.env.NEXT_PUBLIC_SENTRY_CLIENT_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

const tracesSampleRate = getSampleRate(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  process.env.NODE_ENV === "production" ? 0.1 : 1.0
)

if (isSentryClientEnabled) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate,
      integrations: [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.01 : 0,
      replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      enableLogs: true,
      sendDefaultPii: false,
      beforeSend(event) {
        delete event.request?.cookies
        delete event.request?.headers?.authorization

        return event
      },
    })
  })
}

export function onRouterTransitionStart(
  ...args: Parameters<
    typeof import("@sentry/nextjs").captureRouterTransitionStart
  >
) {
  if (!isSentryClientEnabled) {
    return
  }

  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureRouterTransitionStart(...args)
  })
}

function getSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback
  }

  return parsed
}
