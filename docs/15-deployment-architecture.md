# Deployment Architecture

## Purpose

Define the production deployment plan for Vercel, Supabase, environment variables, backups, monitoring, and release operations.

## Overview

The application will deploy to Vercel, with Supabase providing PostgreSQL, Auth, Storage, and platform services. Production deployment must separate environments, protect secrets, run checks before release, and provide rollback and monitoring paths.

## Deployment Targets

| Environment | Purpose | URL Example |
| --- | --- | --- |
| Local | Developer machine | `http://localhost:3000` or assigned port |
| Preview | Pull request validation | Vercel preview URL |
| Staging | Production-like testing | TODO |
| Production | Live platform | TODO |

## Infrastructure Components

| Component | Provider | Responsibility |
| --- | --- | --- |
| Web app | Vercel | Next.js hosting, previews, edge/CDN |
| Database | Supabase | PostgreSQL |
| Auth | Supabase | User identity and sessions |
| Storage | Supabase | Documents, gallery, invoices |
| Payments | Cashfree | Online payment processing |
| Monitoring | TODO | Errors, uptime, logs |

## Environment Variables

Required:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_ENV=
CASHFREE_WEBHOOK_SECRET=
```

Recommended later:

```bash
APP_URL=
INVOICE_BUCKET=
DOCUMENT_BUCKET=
NOTIFICATION_PROVIDER_API_KEY=
MONITORING_DSN=
```

## Deployment Flow

```txt
Developer branch
  -> Pull request
  -> Lint and typecheck
  -> Preview deployment
  -> Review and QA
  -> Merge to main
  -> Production deployment
  -> Smoke test
  -> Monitor errors
```

## Build Checks

Required before merge:

```bash
npm run check
npm run build
```

Recommended later:

```bash
npm run test
npm run test:e2e
```

## Supabase Deployment Planning

Production Supabase setup must include:

- Separate project for production.
- Separate project for staging if budget allows.
- RLS enabled and tested.
- Backups enabled.
- Storage buckets configured.
- Auth redirect URLs configured.
- Database migrations versioned.

## Database Migration Strategy

Preferred:

```txt
supabase/migrations
  -> reviewed SQL changes
  -> local testing
  -> staging apply
  -> production apply
```

TODO: Add Supabase CLI and migration workflow in implementation phase.

## Backup Strategy

- Supabase automated backups.
- Manual backup before major schema changes.
- Monthly financial exports.
- Storage bucket recovery plan.
- Restore test checklist.

## Monitoring Strategy

Minimum production monitoring:

- Vercel deployment and runtime errors.
- Supabase database health.
- Payment webhook failures.
- Auth failure spikes.
- Public website uptime.

Future:

- Sentry or equivalent error tracking.
- Log drain for structured logs.
- Query performance dashboard.
- Notification provider health checks.

## Rollback Strategy

- Use Vercel deployment rollback for frontend.
- Use backward-compatible database migrations where possible.
- Avoid destructive migrations without backups.
- Maintain migration rollback notes.
- Feature-flag risky modules when needed.

## TODO Placeholders

- TODO: Define production domain.
- TODO: Define staging domain.
- TODO: Select monitoring provider.
- TODO: Add Supabase CLI and migrations.
- TODO: Define release owner.
- TODO: Define smoke test checklist.
- TODO: Define rollback procedure for database changes.

## Future Expansion Notes

- Add separate worker service for background jobs.
- Add queue infrastructure for notifications and invoices.
- Add multi-region read strategy if required.
- Add organization-level custom domains for SaaS.
- Add infrastructure-as-code for repeatable environments.

