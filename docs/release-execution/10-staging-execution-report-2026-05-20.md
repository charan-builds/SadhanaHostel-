# Staging Execution Report - 2026-05-20

## Purpose

Record the real staging deployment execution state for Sadhana Boys Hostel Platform.

This is an execution report, not an architecture proposal. Items marked blocked were not executed because required credentials, authentication, or environment values were missing.

## Executive Status

| Area | Status | Notes |
|---|---|---|
| Tooling setup | Partial pass | Supabase, Vercel, k6, and Sentry CLI are available on PATH |
| Supabase account access | Pass | CLI can list Supabase projects |
| Supabase staging project | Found | Existing project: `hostel-erp-staging`, ref `gdpildiullmtfpbetqpu` |
| Supabase local repo link | Blocked | Repo is not linked; database password is required for `supabase link` |
| Vercel authentication | Blocked | CLI is installed but not logged in |
| Sentry CLI PATH | Pass | Project Sentry CLI exposed through `~/.local/bin/sentry-cli` |
| k6 load-test tooling | Pass | k6 installed and checksum-verified |
| `.env.staging` | Blocked | Missing; real staging secrets not available locally |
| Strict preflight | Failed as expected | 15 passed, 7 failed due missing staging env vars |
| Deployment | Not executed | Correctly stopped at preflight gate |
| Migration push | Not executed | Requires Supabase link or DB URL/password |
| Staging seed | Not executed | Requires migrated staging DB and organization/hostel IDs |
| UAT/load/monitoring/recovery | Not executed | Requires deployed staging URL |

## Tooling Verification

| Tool | Version / State |
|---|---|
| Supabase CLI | `2.98.2` |
| Vercel CLI | `54.2.0` |
| k6 | `v2.0.0` |
| Sentry CLI | `2.58.5` |

Notes:

- Supabase CLI reported a newer version is available: `2.100.1`.
- k6 was installed into `~/.local/bin/k6` from the official Grafana k6 GitHub release tarball and verified with SHA256 checksums.
- Vercel CLI started a device login flow, which was stopped because it requires user browser authorization.

## Strict Preflight Result

Command executed:

```bash
npm run release:staging:preflight -- --strict
```

Result:

```text
passed: 15
warnings: 0
failures: 7
```

Failures:

| Missing Value | Severity | Why It Blocks |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Critical | Required for staging URL, health checks, seed safety, and callback URLs |
| `NEXT_PUBLIC_SUPABASE_URL` | Critical | Required for app/backend Supabase connectivity |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Critical | Required for browser and SSR auth client |
| `SUPABASE_SERVICE_ROLE_KEY` | Critical | Required for backend-only seed/admin operations |
| `STAGING_SEED_ORGANIZATION_ID` | Critical | Required for deterministic staging seed |
| `STAGING_SEED_HOSTEL_ID` | Critical | Required for deterministic staging seed |
| `LOAD_TEST_BASE_URL` | High | Required before k6 can target staging |

## Secrets Handling Note

Supabase staging API keys were fetched only to verify availability and were written to a temporary file under `/tmp`.

The temporary file was removed after verification. No fetched Supabase secret values were committed, printed into this report, or left in the repository.

## Required Operator Actions

### 1. Authenticate Vercel CLI

Run interactively:

```bash
vercel login
vercel whoami
```

Pass criteria:

- `vercel whoami` prints the expected staging deployment account.
- No production-only account is selected by mistake.

### 2. Link Supabase Staging Project

Existing staging project discovered:

```text
name: hostel-erp-staging
project_ref: gdpildiullmtfpbetqpu
region: South Asia (Mumbai)
```

Run:

```bash
supabase link --project-ref gdpildiullmtfpbetqpu --password "<staging-db-password>"
```

Verify:

```bash
supabase projects list
```

Pass criteria:

- `hostel-erp-staging` is marked as linked.
- No production Supabase project is linked.

Rollback/unlink:

```bash
rm -rf supabase/.temp
```

### 3. Create `.env.staging`

Start from the example:

```bash
cp .env.staging.example .env.staging
```

Populate with real staging-only values:

```env
NEXT_PUBLIC_APP_URL=https://<vercel-staging-domain>
NEXT_PUBLIC_SUPABASE_URL=https://REDACTED_STAGING_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REDACTED_STAGING_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=REDACTED_STAGING_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SENTRY_DSN=<staging-sentry-dsn>
SENTRY_DSN=<staging-sentry-dsn>
SENTRY_ENVIRONMENT=staging
RESEND_API_KEY=REDACTED_STAGING_RESEND_API_KEY
CRON_SECRET=REDACTED_STAGING_CRON_SECRET
STAGING_SEED_ORGANIZATION_ID=<from migrated/seeded organization>
STAGING_SEED_HOSTEL_ID=<from migrated/seeded hostel>
LOAD_TEST_BASE_URL=https://<vercel-staging-domain>
```

Security rules:

- Do not reuse production service-role keys.
- Do not reuse production cron secrets.
- Do not commit `.env.staging`.
- Rotate any value that was pasted into a chat, issue, or document.

### 4. Load Staging Environment Locally

```bash
set -a
source .env.staging
set +a
```

Validate:

```bash
npm run release:staging:preflight -- --strict
```

Pass criteria:

- `passed` includes all file/tool/env checks.
- `failures: 0`.

## Deployment Sequence After Preflight Passes

### 1. Push Supabase Migrations

Dry run:

```bash
supabase db push --linked --dry-run
```

Apply:

```bash
supabase db push --linked --include-all
```

If the CLI requires a password:

```bash
supabase db push --linked --include-all --password "$STAGING_DB_PASSWORD"
```

### 2. Verify Seeded Organization And Hostel

Run in Supabase SQL editor or psql:

```sql
select id, name, slug from public.organizations where slug = 'sadhana-boys-hostel';
select h.id, h.name, h.code
from public.hostels h
join public.organizations o on o.id = h.organization_id
where o.slug = 'sadhana-boys-hostel';
```

Use those IDs in `.env.staging`:

```env
STAGING_SEED_ORGANIZATION_ID=<organization-id>
STAGING_SEED_HOSTEL_ID=<hostel-id>
NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID=<organization-id>
NEXT_PUBLIC_DEFAULT_HOSTEL_ID=<hostel-id>
```

### 3. Configure Vercel Staging Environment

Recommended pattern: dedicated Vercel staging project.

Link:

```bash
vercel link --yes --project <vercel-staging-project-name-or-id>
```

Pull current env:

```bash
vercel env pull .env.vercel.staging
```

Add/update variables through Vercel dashboard or CLI:

```bash
vercel env add NEXT_PUBLIC_APP_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
vercel env add CRON_SECRET preview
vercel env add SENTRY_DSN preview
vercel env add NEXT_PUBLIC_SENTRY_DSN preview
vercel env add RESEND_API_KEY preview
```

Deploy:

```bash
vercel deploy --target=preview
```

If using a dedicated staging project where production target means staging production:

```bash
vercel deploy --prod
```

### 4. Health Checks

```bash
DEPLOYMENT_URL="$NEXT_PUBLIC_APP_URL" npm run ci:deployment-health
curl -fsS "$NEXT_PUBLIC_APP_URL/api/health/live"
curl -fsS "$NEXT_PUBLIC_APP_URL/api/health/ready"
```

### 5. Run Staging Seed

```bash
npm run staging:seed
```

Post-seed checks:

```sql
select count(*) from public.residents where organization_id = '<organization-id>';
select count(*) from public.rooms where organization_id = '<organization-id>';
select count(*) from public.payments where organization_id = '<organization-id>';
select count(*) from public.invoices where organization_id = '<organization-id>';
select count(*) from public.leave_requests where organization_id = '<organization-id>';
```

Expected:

- Residents: `100+`
- Rooms: configured seed count, default `36`
- Payments/invoices/leaves: non-zero realistic history
- No foreign key failures

### 6. Run k6 Load Test

Baseline:

```bash
LOAD_TEST_BASE_URL="$NEXT_PUBLIC_APP_URL" \
LOAD_TEST_ORGANIZATION_ID="$STAGING_SEED_ORGANIZATION_ID" \
LOAD_TEST_HOSTEL_ID="$STAGING_SEED_HOSTEL_ID" \
k6 run scripts/load-testing/sadhana-hostel.load.js
```

Pilot mutation run:

```bash
LOAD_TEST_BASE_URL="$NEXT_PUBLIC_APP_URL" \
LOAD_TEST_ORGANIZATION_ID="$STAGING_SEED_ORGANIZATION_ID" \
LOAD_TEST_HOSTEL_ID="$STAGING_SEED_HOSTEL_ID" \
LOAD_TEST_RESIDENT_ID="<seeded-resident-id>" \
LOAD_TEST_ADMIN_EMAIL="<staging-admin-email>" \
LOAD_TEST_ADMIN_PASSWORD="<staging-admin-password>" \
LOAD_TEST_RESIDENT_EMAIL="<staging-resident-email>" \
LOAD_TEST_RESIDENT_PASSWORD="<staging-resident-password>" \
LOAD_TEST_MUTATIONS=true \
k6 run scripts/load-testing/sadhana-hostel.load.js
```

SLA targets:

| Metric | Target |
|---|---:|
| HTTP failure rate | `< 1%` |
| API p95 latency | `< 2500 ms` |
| Login p95 latency | `< 1200 ms` |
| Search p95 latency | `< 1500 ms` |
| Export p95 latency | `< 5000 ms` |
| Workflow success rate | `> 95%` |

## UAT Execution Matrix

| Actor | Workflow | Pass Criteria |
|---|---|---|
| Resident | Login | Role-aware redirect to resident dashboard |
| Resident | Onboarding | Profile, Aadhaar, photo, and emergency details save correctly |
| Resident | Payment proof upload | Proof is required, linked, and visible for admin verification |
| Resident | Invoice download | Authorized resident can download only own invoice |
| Resident | Leave apply | Request is submitted and status updates via realtime or refresh |
| Admin | Create resident | Resident is created in correct organization/hostel |
| Admin | Allocate room | Atomic allocation prevents over-capacity |
| Admin | Verify payment | Requires proof, writes audit-safe verification, invoice remains unique |
| Admin | Analytics | Dashboard totals match seeded data |
| Admin | Export | CSV/export respects tenant scope |
| Admin | CMS update | Public website reflects staging CMS content |

## Monitoring Validation Matrix

| Signal | Validation |
|---|---|
| Sentry API errors | Trigger invalid API payload and confirm staging Sentry event |
| Sentry frontend errors | Trigger controlled frontend boundary and confirm environment tag |
| Health endpoints | Live and ready endpoints monitored against staging URL |
| Cron auth | Invalid cron secret returns 401/403 and logs warning |
| Upload failure | Invalid MIME/size is rejected and captured |
| Realtime disconnect | Network interruption recovers or invalidates query state |
| Request correlation | Same request ID appears in response, logs, and Sentry |

## Recovery Drill Sequence

```bash
DATABASE_URL="$STAGING_DATABASE_URL" npm run recovery:backup-check
MIGRATION_VERIFY_DATABASE_URL="$MIGRATION_VERIFY_DATABASE_URL" npm run recovery:migration-verify
RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" npm run recovery:restore-validation
npm run recovery:drill
```

Success criteria:

- Backup check passes.
- Migration replay passes on a clean target.
- Restore validation passes on isolated restore target.
- Recovery timing is recorded.
- No production database is used.

## Current Launch Recommendation

**No-Go for staging deployment execution until critical blockers are resolved.**

Blockers:

1. Vercel CLI not authenticated.
2. `.env.staging` missing real staging values.
3. Supabase repo not linked to staging project.
4. Staging DB password/connection not available for migrations.
5. Staging deployed URL not available for health, UAT, load tests, or monitoring validation.

Confidence scores at this point:

| Category | Score | Reason |
|---|---:|---|
| Tooling readiness | 80/100 | All tools available; Vercel auth still required |
| Staging infra confidence | 45/100 | Supabase staging project found; Vercel/Sentry/Resend not verified |
| Deployment readiness | 30/100 | Strict preflight blocked by missing env |
| Security readiness | 60/100 | Correctly stopped before unsafe/fake deployment |
| Launch readiness | 25/100 | No real staging deployment/UAT/load/DR evidence yet |

