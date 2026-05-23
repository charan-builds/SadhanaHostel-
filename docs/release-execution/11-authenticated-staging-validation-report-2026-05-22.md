# Authenticated Staging Validation Report

Project: Sadhana Boys Hostel Platform  
Date: 2026-05-22  
Executor: Codex release validation pass  
Scope: staging readiness, local release gates, provider auth checks, authenticated Playwright attempt, health/load probes, recovery readiness.

## Executive Summary

Result: **NO-GO for controlled soft launch until staging credentials and infrastructure evidence are fixed.**

The local production build, smoke suite, security tests, local deployment-health probe, and local k6 health probe all pass. However, authenticated staging proof could not be completed because this workstation does not currently have a confirmed staging environment file, a usable Vercel noninteractive login, valid seeded admin/resident credentials, or staging database recovery URLs.

This report does not assume success. It records what was executed and what remains blocked.

## Environment Evidence

| Item | Result | Evidence |
| --- | --- | --- |
| `.env.staging` | Fail | File missing. |
| `.env.staging.local` | Fail | File missing. |
| `.env.staging.example` | Pass | Present. |
| Supabase CLI | Pass | Installed: `2.98.2`; update available. |
| Vercel CLI | Tool present, auth blocked | `vercel whoami` started device login and timed out in noninteractive execution. |
| Sentry CLI | Pass | Auth token accepted for org/project configured in local env. |
| k6 | Pass | Installed: `v2.0.0`. |
| Local Supabase status | Fail | Local container not running: missing `supabase_db_sadhana-hostel`. |

## Staging Preflight

Command:

```bash
set -a; . ./.env.local; set +a
npm run release:staging:preflight -- --strict
```

Result: **Fail**

Summary:

| Check | Result |
| --- | --- |
| Required release files | Pass |
| Required tools | Pass |
| `NEXT_PUBLIC_APP_URL` | Pass |
| `NEXT_PUBLIC_SUPABASE_URL` | Pass |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pass |
| `SUPABASE_SERVICE_ROLE_KEY` | Pass |
| `STAGING_SEED_ORGANIZATION_ID` | Fail |
| `STAGING_SEED_HOSTEL_ID` | Fail |
| `LOAD_TEST_BASE_URL` | Fail |

Impact: real staging seeding and authenticated load testing are blocked. Running seed/migration commands without these values would risk mutating the wrong Supabase project.

## Local Release Gate Results

Command:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:smoke
npm run test:security
```

Result: **Pass**

Evidence:

| Gate | Result |
| --- | --- |
| Lint | Pass |
| TypeScript | Pass |
| Vitest | Pass: 82 passed, 5 skipped |
| Next production build | Pass |
| Playwright smoke | Pass: 40 passed, 9 credential-gated skipped |
| Security tests | Pass: 7 passed, 3 DB/staging-gated skipped |

Notes:

- Build confirms protected admin/resident routes are dynamic.
- Smoke suite validates public rendering, login pages, protected route redirects, anonymous finance/upload abuse resistance, staff-access API auth rejection, setup API auth rejection, and gallery upload file enforcement.
- DB-backed RLS/storage security tests remain skipped without a live test database/staging project.

## Authenticated Playwright Attempt

Command:

```bash
set -a; . ./.env.local; set +a
E2E_AUTH_RUN_REAL_FLOWS=true \
E2E_OPERATIONAL_UAT_RUN_MUTATIONS=true \
npm run test:smoke
```

Result: **Fail**

Evidence:

| Area | Result |
| --- | --- |
| Anonymous/public smoke checks | Pass: 40 passed |
| Payment security mutation tests | Skipped: mutation flag not enabled |
| Admin authenticated flow | Fail: login remained on `/admin/login` |
| Resident authenticated flow | Fail: login remained on `/resident/login` |
| Operational admin surfaces | Fail: admin login did not succeed |
| Auth API response | `401 Invalid email or password`, followed by `429 RATE_LIMITED` after repeated attempts |

Root cause: the admin/resident credentials available in `.env.local` are not valid for the currently configured Supabase project, or the users are not seeded/activated with expected roles.

Impact: authenticated staging proof is not available.

Required fix:

1. Seed or create staging owner/admin/resident users.
2. Confirm their roles and tenant linkage.
3. Update `.env.staging.local` or CI secrets:

```env
E2E_AUTH_RUN_REAL_FLOWS=true
E2E_OPERATIONAL_UAT_RUN_MUTATIONS=true
E2E_ADMIN_EMAIL=
E2E_ADMIN_PASSWORD=
E2E_RESIDENT_EMAIL=
E2E_RESIDENT_PASSWORD=
```

4. Re-run authenticated smoke after the auth rate-limit window clears.

## Deployment Health

Staging deployment health could not be run because no real `LOAD_TEST_BASE_URL` or staging deployment URL is configured.

Local production-build health was executed:

```bash
DEPLOYMENT_URL=http://127.0.0.1:3101 \
ALLOW_NOT_READY=true \
npm run ci:deployment-health
```

Result: **Pass locally**

| Check | Status |
| --- | --- |
| `/api/health/live` | Pass: 200 JSON |
| `/api/health/ready` | Pass: 200 JSON |
| `/api/v1/openapi` | Pass: 200 JSON |
| `/admin/dashboard` protection | Pass: 307 to login |
| `/resident/dashboard` protection | Pass: 307 to login |

## k6 Load Probe

Authenticated staging load could not be run because `LOAD_TEST_BASE_URL`, staging IDs, and valid credentials are not configured.

Local health-only load was executed:

```bash
LOAD_TEST_BASE_URL=http://127.0.0.1:3101 \
LOAD_TEST_DURATION=5s \
LOAD_TEST_SCENARIOS=health \
k6 run scripts/load-testing/sadhana-hostel.load.js
```

Result: **Pass locally**

Metrics:

| Metric | Result |
| --- | --- |
| HTTP p95 | 686.56 ms |
| HTTP failed rate | 0 |
| Workflow success rate | 1 |
| API errors | 0 |
| Payment failures | 0 |
| Upload failures | 0 |

Generated artifacts:

- `scripts/load-testing/last-summary.json`
- `scripts/load-testing/last-summary.md`

## Supabase Cloud Security Validation

Result: **Blocked**

Required checks not completed:

- Staging project confirmation.
- Migration replay against staging.
- RLS table audit.
- Storage bucket audit.
- Signed URL access validation.
- Upload ownership validation.
- Cross-tenant blocking validation.

Observed blockers:

- No `.env.staging` or `.env.staging.local`.
- No `STAGING_SEED_ORGANIZATION_ID`.
- No `STAGING_SEED_HOSTEL_ID`.
- No staging DB URL for recovery/security scripts.
- Local Supabase is not running for local migration replay.

Required commands after staging env is configured:

```bash
supabase link --project-ref <staging-project-ref>
supabase db push
npm run staging:seed
TEST_DATABASE_URL=<staging-or-isolated-test-db-url> npm run test:security
```

## Sentry Validation

Result: **Partial pass**

Sentry CLI authentication works with local env:

| Check | Result |
| --- | --- |
| Auth token accepted | Pass |
| Organization/project visible | Pass |

Not completed:

- Controlled staging frontend error capture.
- Controlled API error capture in staging.
- Trace/request ID correlation in Sentry dashboard.
- Source-map verification from deployed release.

Required staging evidence:

```bash
SENTRY_ENVIRONMENT=staging
NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
SENTRY_UPLOAD_SOURCE_MAPS=true
npm run build
```

Then trigger one controlled frontend and one controlled API error on staging and attach Sentry event IDs.

## Disaster Recovery Validation

Result: **Blocked**

Commands attempted:

```bash
npm run recovery:backup-check
npm run recovery:migration-verify
```

Evidence:

| Check | Result |
| --- | --- |
| Backup check | Fail: `DATABASE_URL is required` |
| Migration verify | Fail: attempted local `127.0.0.1:54322`, connection refused |
| Restore validation | Not run; no `RESTORE_DATABASE_URL` |

Required env:

```env
DATABASE_URL=
MIGRATION_VERIFY_DATABASE_URL=
RESTORE_DATABASE_URL=
DATABASE_SSL=true
```

Required command:

```bash
npm run recovery:drill
```

## Pass/Fail Matrix

| Area | Status | Notes |
| --- | --- | --- |
| Local lint/type/test/build | Pass | Full requested non-mutating gate passed. |
| Local smoke/security | Pass | Credential-gated and DB-backed tests remain skipped. |
| Staging env file | Fail | Missing. |
| Vercel staging auth | Fail | CLI entered device login flow. |
| Supabase staging confirmation | Fail | Not enough staging env/link evidence. |
| Staging seed | Blocked | Unsafe without confirmed staging target. |
| Authenticated Playwright | Fail | Invalid credentials/rate limiting. |
| Authenticated k6 | Blocked | No staging URL/IDs/valid credentials. |
| Local health/load probes | Pass | Useful script and endpoint evidence only. |
| Sentry auth | Partial pass | CLI auth works; dashboard event validation not complete. |
| RLS/storage cloud validation | Blocked | Needs staging DB/storage credentials. |
| Disaster recovery | Blocked | Missing DB URLs. |

## P0 Launch Blockers

1. Create `.env.staging.local` with staging-only values.
2. Authenticate Vercel CLI or use `VERCEL_TOKEN` for noninteractive validation.
3. Confirm Supabase staging project link and apply migrations.
4. Seed staging data and auth users.
5. Fix/replace invalid E2E admin/resident credentials.
6. Re-run authenticated Playwright after the auth rate-limit clears.
7. Run full authenticated k6 against staging.
8. Run live RLS/storage/security validation against staging.
9. Run backup/restore drill with staging recovery URLs.
10. Trigger Sentry staging events and verify source maps/request IDs.

## GO / NO-GO

Recommendation: **NO-GO for controlled soft launch today.**

Reason: local quality gates pass, but authenticated staging proof is not established. The platform may be code-ready, but release evidence is incomplete at the infrastructure and credential layer.

Soft-launch can move to **GO** only after:

- authenticated Playwright passes with seeded staging users,
- full k6 staging scenarios pass,
- Supabase RLS/storage checks pass,
- Sentry staging event capture is verified,
- disaster recovery drill passes.
