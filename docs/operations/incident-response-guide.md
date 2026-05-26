# Incident Response Guide

Use this guide during launch-impacting incidents.

## Immediate Actions

1. Classify severity.
2. Stop expansion of the resident cohort.
3. If user safety, financial integrity, or tenant isolation is at risk, set `MAINTENANCE_MODE=true`.
4. Capture request IDs, Sentry event links, affected user IDs, and timestamps.
5. Assign one incident lead and one communications owner.

## Critical Incident Criteria

- Unauthorized admin/resident access.
- Cross-tenant data exposure.
- Payment verification or invoice corruption.
- Duplicate room allocation or overbooking.
- Service-role secret exposure.
- Storage signed URL leakage.
- Production deployment health failing for more than 5 minutes after release.

## Rollback Procedure

1. Enable `MAINTENANCE_MODE=true`.
2. Set `CRON_JOBS_ENABLED=false` if scheduled jobs could worsen the incident.
3. Set `OPERATIONAL_REPAIRS_ENABLED=false` if repair execution must be paused while preserving dry-run diagnostics.
4. Confirm `/api/health/live` still returns `200`.
5. Roll back Vercel to the previous healthy deployment.
6. Do not roll back database migrations unless a documented backward migration exists.
7. Run `DEPLOYMENT_URL=<url> npm run ci:deployment-health`.
8. Run targeted smoke tests for auth, onboarding, payments, and admin route protection.
9. Disable maintenance mode only after the incident lead approves.

## Evidence Collection

- Sentry event URL.
- `x-request-id` from UI/API response.
- User role and tenant scope.
- Payment/invoice/reservation IDs if financial or vacancy related.
- Deployment SHA and migration version.
- Exact recovery actions performed.

## Post-Incident Review

- Root cause.
- Blast radius.
- Data repair actions.
- Tests added.
- Monitoring or alert changes.
- Owner approval before restarting rollout expansion.
