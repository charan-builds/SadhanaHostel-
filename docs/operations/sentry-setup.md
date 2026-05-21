# Sentry Setup

## Purpose

This guide defines the production-safe Sentry configuration for Sadhana Boys Hostel Platform across local, staging, and production environments.

## Environment Variables

Client-side capture uses only public DSN variables:

```env
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=local
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

Server, edge, release, and source-map upload use server-only variables:

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=local
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

## Local Development

Use `.env.local` for local-only values. Keep Sentry disabled locally by leaving `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` empty, or point them to a disposable local/dev Sentry project.

Recommended local values:

```env
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=local
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1

SENTRY_DSN=
SENTRY_ENVIRONMENT=local
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

## Staging

Use a separate Sentry environment or project for staging. Do not reuse production DSNs or auth tokens.

Required Vercel preview/staging variables:

```env
NEXT_PUBLIC_SENTRY_DSN=<staging-browser-dsn>
NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.2

SENTRY_DSN=<staging-server-dsn>
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=0.2
SENTRY_ORG=<sentry-org-slug>
SENTRY_PROJECT=<staging-project-slug>
SENTRY_AUTH_TOKEN=<ci-source-map-upload-token>
```

## Production

Production source maps are uploaded through the Sentry build plugin when `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are present. Generated source maps are deleted after upload and should not be publicly exposed.

Recommended production values:

```env
NEXT_PUBLIC_SENTRY_DSN=<production-browser-dsn>
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1

SENTRY_DSN=<production-server-dsn>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ORG=<sentry-org-slug>
SENTRY_PROJECT=<production-project-slug>
SENTRY_AUTH_TOKEN=<ci-source-map-upload-token>
```

## Sampling Policy

- Client traces default to `0.1` in production and `1.0` outside production when no env override is provided.
- Server and edge traces use the same default.
- Session Replay is masked, media-blocked, and sampled at low production rates:
  - production session replay: `0.01`
  - production replay on error: `0.1`
  - non-production replay on error: `1.0`

## Security Rules

- Never commit `SENTRY_AUTH_TOKEN`.
- Never expose `SENTRY_AUTH_TOKEN` through `NEXT_PUBLIC_`.
- Keep `.env.sentry-build-plugin` gitignored.
- Keep `sendDefaultPii=false`.
- Scrub cookies and authorization headers before sending events.

## Controlled Validation

Use existing route error boundaries or a temporary local-only test route to validate capture. Do not keep Sentry wizard demo routes in the production tree.

Validation checklist:

- [ ] Frontend render error creates a Sentry issue with `environment`.
- [ ] API error creates a Sentry issue with route/request context.
- [ ] Source maps resolve stack traces in staging/production.
- [ ] Replay is attached only according to sampling policy.
- [ ] Logs appear without cookies, bearer tokens, or service-role keys.
