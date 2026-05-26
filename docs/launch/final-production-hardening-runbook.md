# Final Production Hardening Runbook

Use this runbook for the controlled soft-launch gate. Every command must run against staging first with staging-only Supabase, Vercel, Sentry, Resend, and Redis credentials.

## Environment Gate

1. Export staging runtime values or load `.env.staging`.
2. Verify no placeholder values remain:

```bash
npm run release:staging:preflight -- --strict
npm run release:production:hardening
```

Required proof:

- `NEXT_PUBLIC_APP_URL`, `DEPLOYMENT_URL`, and `LOAD_TEST_BASE_URL` point to staging, not localhost.
- `LAUNCH_MODE=staging` for staging validation, then `LAUNCH_MODE=soft_launch` for controlled rollout.
- `SENTRY_ENVIRONMENT=staging` or `soft_launch`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are different.
- `CRON_JOBS_ENABLED` and `OPERATIONAL_REPAIRS_ENABLED` match the launch window decision.

## Authenticated UAT

Run with synthetic staging users only:

```bash
E2E_AUTH_RUN_REAL_FLOWS=true PLAYWRIGHT_BASE_URL=$DEPLOYMENT_URL npm run test:smoke
```

Required resident flow:

- enquiry
- onboarding invite
- activation
- phone login or activation link login
- onboarding completion
- room allocation verification
- UPI payment proof submission
- leave request
- checkout recovery

Required admin and finance flow:

- resident quick-create
- resend invite
- onboarding approval or rejection
- QR upload and preview
- payment verification and rejection
- occupancy repair dry run
- checkout reconciliation
- consistency repair execution in a staffed window

## Load Gate

Run authenticated staging load only after UAT passes:

```bash
LOAD_TEST_BASE_URL=$LOAD_TEST_BASE_URL \
LOAD_TEST_SCENARIOS=health,resident,admin,uploads,realtime \
npm run load:k6
```

Investigate any endpoint with high error rate, repeated 5xx responses, upload timeouts, or realtime reconnect storms. Do not proceed if consistency scans or checkout flows slow down under load.

## Operations Gate

Before inviting real residents:

- Admin Launch Readiness has zero failed checks.
- Admin Alerts has no Critical or High launch-blocking alerts.
- Storage buckets exist and sensitive buckets are private.
- Signed URL TTL is between 60 and 3600 seconds.
- Cron auth rejects requests without `Authorization: Bearer $CRON_SECRET`.
- Sentry captures browser, API, and job errors in the staging environment.
- Consistency Validation dry run returns no Critical findings.

## Kill Switches

- `MAINTENANCE_MODE=true`: pause user traffic while preserving health checks.
- `CRON_JOBS_ENABLED=false`: stop scheduled automation if it could amplify an incident.
- `OPERATIONAL_REPAIRS_ENABLED=false`: allow diagnostics but block mutating repair actions.
- `FEATURE_FLAGS`: disable unapproved modules before rollout expansion.

## Go Criteria

- All local quality gates pass.
- Authenticated staging smoke tests pass.
- k6 staging run has acceptable latency and no data corruption.
- Launch readiness has zero failures.
- Support owner, incident owner, and rollback owner are assigned.
