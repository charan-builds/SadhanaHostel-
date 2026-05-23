# Controlled Soft-Launch Readiness Report

Date: 2026-05-23

Project: Sadhana Boys Hostel Platform

## Launch Position

Current recommendation: **No-Go for real residents until staging credentials are loaded and authenticated staging validation passes.**

The platform now has the core launch-readiness controls required for a controlled rollout:

- Feature flags for staged module exposure.
- Maintenance mode with operator bypass.
- Admin launch-readiness dashboard.
- Launch diagnostics APIs.
- Support and incident runbooks.
- First-30-days operations guide.
- Local release validation tooling.

The remaining launch gate is not code architecture. It is real staging proof against deployed Supabase, Vercel, Sentry, storage, and load-test targets.

## Local Verification

The latest local engineering validation completed successfully:

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run test`: passed
- `npm run build`: passed
- `npm run test:smoke`: passed

Smoke test result from the latest run:

- 49 passed
- 9 skipped

The skipped smoke tests are credential-gated real-authentication flows and should run during staging validation with `E2E_AUTH_RUN_REAL_FLOWS=true`.

## Soft-Launch Validator Result

Command:

```bash
npm run release:soft-launch:validate
```

Result:

- Passed checks: 12
- Warnings: 7
- Failures: 4

Current validator decision:

```text
NO_GO: resolve failed checks before inviting real residents.
```

Failed checks:

- `DEPLOYMENT_URL` missing
- `LOAD_TEST_BASE_URL` missing
- `NEXT_PUBLIC_SUPABASE_URL` missing
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` missing

Warnings:

- `SENTRY_DSN` missing
- `SENTRY_ENVIRONMENT` missing
- `CRON_SECRET` missing
- `UPSTASH_REDIS_REST_URL` missing
- `UPSTASH_REDIS_REST_TOKEN` missing
- `LAUNCH_SUPPORT_WHATSAPP` missing
- `LAUNCH_OWNER_EMAIL` missing

These are expected in a local shell without staging launch environment loaded. They are launch blockers for real staging execution.

## Staging Execution Gate

Before inviting real residents, run the strict validation gate with staging environment variables loaded:

```bash
npm run release:soft-launch:validate -- --strict
```

Then run the real staging proof commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build

DEPLOYMENT_URL=$DEPLOYMENT_URL npm run ci:deployment-health

E2E_AUTH_RUN_REAL_FLOWS=true \
PLAYWRIGHT_BASE_URL=$DEPLOYMENT_URL \
npm run test:smoke

LOAD_TEST_BASE_URL=$LOAD_TEST_BASE_URL \
LOAD_TEST_SCENARIOS=health,resident,admin,uploads,realtime \
npm run load:k6

supabase db push --dry-run
```

## Required Cloud Validation

The following must be verified against staging infrastructure, not only locally:

- Authenticated Playwright: admin, resident, finance, invite activation, payment verification, QR rotation, role enforcement.
- k6 load scenarios: health, resident workflows, admin workflows, uploads, realtime.
- Supabase RLS: resident self-only access, admin tenant scope, staff role restrictions.
- Storage isolation: private buckets, signed URLs, upload ownership, cross-tenant denial.
- Sentry: browser error, API error, cron/job error, request ID correlation, source maps.
- Cron visibility: scheduled jobs run, failed jobs alert, retry behavior is visible.

## Launch Safeguards

Production launch must start with:

- `MAINTENANCE_MODE=false`
- `MAINTENANCE_BYPASS_TOKEN` configured and shared only with operators
- `FEATURE_FLAGS` limited to approved modules
- `SOFT_LAUNCH_RESIDENT_LIMIT` set to the first cohort size
- Support WhatsApp and owner escalation email configured
- Admin launch-readiness dashboard showing zero failed checks

## Database Deployment Notes

Pending operational migrations must be pushed and verified before staging or production rollout:

- `20260522006000_operations_automation_control.sql`
- `20260523001000_owner_analytics_indexes.sql`

After migration replay, verify:

- operations automation tables exist
- owner analytics indexes exist
- RLS remains enabled on financial, resident, invite, reservation, support, and operations tables
- storage buckets remain private and signed-url based

## Pilot Rollout Recommendation

Start with a controlled cohort:

- 1 owner
- 1 admin
- 1 finance user
- 1 receptionist or warden
- 10-20 residents

Daily launch metrics:

- activation rate
- onboarding completion rate
- payment success rate
- pending verification count
- occupancy health
- support issue volume
- failed cron count
- Sentry error volume

## Go/No-Go Rule

Go:

- strict validator passes
- authenticated staging Playwright passes
- k6 scenarios stay within accepted thresholds
- RLS and storage isolation pass
- Sentry captures controlled errors
- support owner is assigned

No-Go:

- any auth, RLS, storage, payment, invoice, onboarding, tenant isolation, or launch diagnostics failure remains unresolved
- support escalation is not staffed
- maintenance bypass is missing
- production rollback path is not rehearsed
