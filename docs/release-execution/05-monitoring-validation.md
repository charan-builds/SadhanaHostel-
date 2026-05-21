# Monitoring Validation Runbook

## Purpose

Validate that staging monitoring behaves like production monitoring without sending production-grade noise to the production incident channel.

This runbook verifies Sentry, deployment health checks, API failure alerts, upload failures, cron failures, realtime disconnect visibility, and request correlation.

## Scope

Applies to the staging Vercel deployment, staging Supabase project, staging Sentry environment, staging Resend configuration, and staging uptime checks.

## Preconditions

- Staging deployment is live.
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging` is configured.
- Sentry DSN and auth token are staging-specific.
- Uptime checks target the staging URL only.
- Alert routing is connected to the staging engineering channel, not production escalation.

## Required Environment

```bash
export STAGING_APP_URL="https://your-staging-domain.vercel.app"
export DEPLOYMENT_URL="$STAGING_APP_URL"
export SENTRY_ENVIRONMENT="staging"
```

## Baseline Health Validation

Run:

```bash
npm run ci:deployment-health
```

Expected:

- `/api/health/live` returns HTTP 200.
- `/api/health/ready` returns HTTP 200.
- Response includes staging environment metadata.
- Response does not expose secrets, service-role keys, connection strings, or raw stack traces.

## Alert Validation Scenarios

| Scenario | Execution | Expected Signal | Launch Blocking If |
|---|---|---|---|
| API failure | Submit invalid payload to a protected staging API | Sentry issue with requestId, route, environment | No Sentry event or missing request correlation |
| Auth failure | Attempt invalid login repeatedly | Rate-limit metric and auth error logs | Credentials or tokens appear in logs |
| Upload failure | Upload invalid MIME or oversized file | Upload failure event with tenant-safe metadata | File is stored or failure is silent |
| Payment verification failure | Attempt verification without proof | Payment error with audit-safe context | Verification succeeds or proof URL leaks |
| Cron auth failure | Call cron endpoint without secret | Warning/error event, HTTP 401/403 | Cron runs without valid secret |
| Realtime disconnect | Disable network during resident payment status screen | Client reconnect/error signal | UI remains stale without recovery path |
| Deployment health failure | Temporarily target invalid readiness URL in uptime monitor | Staging alert fires | Alert routes to production channel |

## Request Correlation Check

For one failed API request, confirm the same `requestId` appears in:

- Browser network response error body.
- Server structured logs.
- Sentry event tags.
- API request metric entry.

Pass criteria:

- `requestId` is present.
- `tenantId` is present only when authenticated and authorized.
- `userId` is present only when authenticated.
- Sensitive request payload fields are redacted.

## Sentry Validation Checklist

- [ ] Frontend rendering errors are captured.
- [ ] API route errors are captured.
- [ ] Background job failures are captured.
- [ ] Payment failures include non-sensitive payment metadata.
- [ ] Upload failures include file type and size, not raw file contents.
- [ ] Events include `environment=staging`.
- [ ] Events include route names.
- [ ] Events include request IDs.
- [ ] Tenant and user tags are never attached across tenants.
- [ ] PII is redacted from breadcrumbs and contexts.

## Cron Monitoring Checklist

- [ ] Monthly fee generation job run is logged.
- [ ] Payment reminder job run is logged.
- [ ] Invoice cleanup job run is logged.
- [ ] Stale upload cleanup job run is logged.
- [ ] Scheduled notices job run is logged.
- [ ] Unauthorized cron requests are rejected and logged.
- [ ] Failed jobs include retry-safe identifiers.
- [ ] Successful jobs include processed counts and duration.

## Upload Monitoring Checklist

- [ ] Aadhaar upload success is logged with document ID only.
- [ ] Payment proof upload success is logged with payment/document linkage.
- [ ] Profile photo upload success is logged with user/resident linkage.
- [ ] Invalid MIME is rejected and logged.
- [ ] Oversized file is rejected and logged.
- [ ] Storage signed URL failures are logged without exposing bucket internals.

## Realtime Monitoring Checklist

- [ ] Payment status events are received by the correct resident/admin clients.
- [ ] Cross-tenant subscriptions do not receive events.
- [ ] Duplicate events do not duplicate visible UI rows.
- [ ] Reconnect invalidates relevant React Query keys.
- [ ] Realtime disconnect is visible in client diagnostics.

## Noisy Alert Review

After at least one UAT and one load-test pass, review:

| Alert | Count | Root Cause | Action |
|---|---:|---|---|
| TODO | TODO | TODO | TODO |

No-go criteria:

- Repeated false-positive alerts during normal UAT.
- Missing alerts for intentional staging failures.
- Production channel receives staging-only alerts.

## Signoff

| Owner | Area | Status | Evidence Link |
|---|---|---|---|
| Release engineer | Health checks | TODO | TODO |
| Backend engineer | API failures | TODO | TODO |
| Frontend engineer | Client errors | TODO | TODO |
| Operations owner | Alert routing | TODO | TODO |

