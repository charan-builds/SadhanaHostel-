# Staging Deployment Checklist

## Purpose

Validate that staging is production-like enough to catch release, data, security, and operational failures before go-live.

## Environment Contract

| Area | Requirement | Owner | Status |
| --- | --- | --- | --- |
| Vercel project | Dedicated staging project or staging alias | DevOps | TODO |
| Supabase project | Separate staging project, never shared with production | Backend | TODO |
| Storage buckets | `resident-documents`, `payment-screenshots`, `gallery-images`, `invoices` | Backend | TODO |
| Secrets | Values copied from `.env.staging.example` into Vercel Staging | DevOps | TODO |
| Cron secret | Unique staging-only value, 32+ chars | DevOps | TODO |
| Sentry env | `staging` configured and visible in Sentry | DevOps | TODO |
| Resend | Test sender, `NOTIFICATIONS_SEND_ENABLED=false` by default | Ops | TODO |
| Cashfree | Sandbox credentials only | Finance/Ops | TODO |

## Pre-Deploy Gate

Run locally or in CI:

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run ci:bundle-budget
```

## Supabase Staging Gate

1. Create or reset a disposable staging verification database.
2. Replay migrations:

```bash
npm run recovery:migration-verify
```

3. Apply migrations to the Supabase staging project.
4. Validate RLS/storage policies with staging admin and resident users.
5. Generate synthetic data:

```bash
npm run staging:seed
```

## Vercel Staging Gate

1. Deploy `main` or release branch to Vercel staging.
2. Confirm environment variables match `.env.staging.example`.
3. Run post-deploy checks:

```bash
DEPLOYMENT_URL=https://staging.example.com npm run ci:deployment-health
PLAYWRIGHT_BASE_URL=https://staging.example.com PLAYWRIGHT_SKIP_WEB_SERVER=true npm run test:smoke
```

## Functional Smoke Matrix

| Workflow | Expected Result | Status |
| --- | --- | --- |
| `/api/health/live` | `200`, JSON `status=ok` | TODO |
| `/api/health/ready` | `200`, DB/cache/storage/env checks true | TODO |
| Unauth `/admin/dashboard` | Redirects to `/login` before render | TODO |
| Unauth `/resident/dashboard` | Redirects to `/login` before render | TODO |
| Admin login | Redirects to `/admin/dashboard` | TODO |
| Resident login | Redirects to `/resident/dashboard` | TODO |
| Payment proof upload | Requires linked payment and signed preview works | TODO |
| Payment verification | Blocks without proof, succeeds with proof | TODO |
| Room allocation | Cannot overfill under concurrent requests | TODO |
| Invoice generation | One invoice per monthly fee record | TODO |
| Realtime payment update | Subscriber receives hostel-scoped event | TODO |

## Rollback Readiness

- [ ] Last successful Vercel deployment identified.
- [ ] Last safe Supabase migration identified.
- [ ] Backward compatibility of current app and DB confirmed.
- [ ] Rollback owner and communication channel assigned.
- [ ] `docs/deployment/rollback.md` reviewed by release owner.

## Launch Sign-Off

| Role | Name | Date | Sign-Off |
| --- | --- | --- | --- |
| Product owner | TODO | TODO | TODO |
| Backend owner | TODO | TODO | TODO |
| Frontend owner | TODO | TODO | TODO |
| DevOps owner | TODO | TODO | TODO |
| Security reviewer | TODO | TODO | TODO |
| Hostel operations | TODO | TODO | TODO |
