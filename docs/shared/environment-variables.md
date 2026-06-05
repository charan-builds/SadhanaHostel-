# Environment Variables

## Purpose

Define environment variable contracts shared between frontend, backend, deployment, and operations.

## Scope

Covers local, preview, staging, and production environment variables for Next.js, Supabase, Cashfree, storage, notifications, monitoring, and future SaaS operations.

## Responsibilities

Frontend responsibilities:

- Use only `NEXT_PUBLIC_*` variables in client-safe code.
- Never import server-only env values in client components.

Backend responsibilities:

- Validate server environment values.
- Keep secrets out of browser bundles.
- Document new variables in `.env.example` and this file.

## Architecture Overview

```txt
.env.local
  -> Next.js runtime
  -> client-safe NEXT_PUBLIC values
  -> server-only secrets
  -> Vercel environment settings
```

## Current Variables

| Variable | Scope | Required | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client/server | Yes after Supabase setup | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client/server | Yes after Supabase setup | Supabase anonymous key |
| `NEXT_PUBLIC_APP_URL` | Client/server | Yes in staging/production | Canonical public app URL used for sitemap, robots, invite links, and SEO metadata |
| `NEXT_PUBLIC_LAUNCH_MODE` | Client/server | Yes in staging/production | Public launch mode. Use `production` only for the live domain that should be indexed |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Client/server | Production SEO optional | Google Search Console HTML meta verification token for the live public domain |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Client/server | Production analytics optional | Google Analytics 4 measurement ID for the live public domain, for example `G-39K0JSVGSZ` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Later | Privileged server operations |
| `CASHFREE_APP_ID` | Server only | Later | Cashfree app ID |
| `CASHFREE_SECRET_KEY` | Server only | Later | Cashfree secret |
| `CASHFREE_ENV` | Server only | Later | `sandbox` or `production` |

## Future Variables

```bash
APP_URL=
CASHFREE_WEBHOOK_SECRET=
INVOICE_BUCKET=
DOCUMENT_BUCKET=
GALLERY_BUCKET=
EMAIL_PROVIDER_API_KEY=
SMS_PROVIDER_API_KEY=
WHATSAPP_PROVIDER_API_KEY=
MONITORING_DSN=
CRON_SECRET=
```

## Production SEO Variables

Set these in Vercel Production before asking Google to index the site:

```bash
NEXT_PUBLIC_APP_URL=https://<production-domain>
NEXT_PUBLIC_LAUNCH_MODE=production
LAUNCH_MODE=production
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<google-search-console-meta-token>
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-39K0JSVGSZ
```

Leave `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` empty in local/staging unless that exact property is intentionally verified. Preview/staging domains should not be indexed.
Leave `NEXT_PUBLIC_GA_MEASUREMENT_ID` empty outside production unless staging traffic should intentionally appear in GA4.

## Environment Rules

- `.env.local` is never committed.
- `.env.example` contains names but no secrets.
- Vercel production variables must be reviewed before launch.
- Rotate secrets after suspected exposure.
- Do not prefix secrets with `NEXT_PUBLIC_`.

## Validation Placeholder

```ts
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CASHFREE_SECRET_KEY: z.string().min(1),
})
```

## TODO Placeholders

- TODO: Add all final variables to `.env.example`.
- TODO: Add runtime env validation for server-only values.
- TODO: Define staging vs production values.
- TODO: Define secret rotation process.
- TODO: Define owner for environment management.

## Future Scalability Notes

- Add tenant-specific provider settings in database rather than environment variables.
- Add secret manager if platform grows beyond Vercel-managed env.
- Add per-environment config validation in CI.
