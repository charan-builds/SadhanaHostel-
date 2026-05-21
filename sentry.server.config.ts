import * as Sentry from "@sentry/nextjs"

const tracesSampleRate = getSampleRate(
  process.env.SENTRY_TRACES_SAMPLE_RATE,
  process.env.NODE_ENV === "production" ? 0.1 : 1.0
)

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate,
  enableLogs: true,
  sendDefaultPii: false,
  beforeSend(event) {
    delete event.request?.cookies
    delete event.request?.headers?.authorization

    return event
  },
})

function getSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback
  }

  return parsed
}
