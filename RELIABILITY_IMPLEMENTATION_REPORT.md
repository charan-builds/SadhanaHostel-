# Reliability Implementation Report

Date: 2026-06-07

Branch: `backend-feature-migration`

Context:

- Previous edge-case implementation already fixed notice room/role audience targeting.
- This pass implemented additional reliability hardening for retry safety, double-submit prevention, Web Push transient failures, and background job failure behavior.

Mode: implementation. No database schema or public API contract changes.

## Summary

Implemented production reliability fixes in three backend-critical layers:

- API retry policy now avoids accidental double submissions for unsafe mutations.
- Web Push delivery now retries transient provider/network failures with bounded backoff and still revokes permanent dead endpoints.
- Background job retries now keep a stable run id, apply retry backoff, record failed attempts, and do not retry successful job side effects just because audit logging failed.

## Files Changed

- `src/lib/api-client/api-fetch.ts`
- `src/tests/unit/lib/api-client.test.ts`
- `src/services/pwa/web-push.service.ts`
- `src/tests/unit/services/web-push.service.test.ts`
- `src/jobs/job-runner.ts`
- `src/tests/unit/jobs/job-runner.test.ts`
- `RELIABILITY_IMPLEMENTATION_REPORT.md`

## Fixes Implemented

### 1. Double-Submission Safe API Retries

Before:

- `apiFetch` defaulted to one retry for all requests.
- A transient network failure on a mutation could retry a non-idempotent POST/PATCH/PUT/DELETE.

After:

- GET requests keep the default retry behavior.
- Unsafe mutations retry only when an idempotency key is present in `body.idempotencyKey` or `x-idempotency-key`.
- Mutations without idempotency do not retry, even if a retry count is passed.

Reliability impact:

- Prevents accidental duplicate writes after network timeouts or offline recovery reconnects.
- Preserves safe retry behavior for idempotent payment/support style mutations.

Tests added:

- Non-idempotent POST does not retry.
- Idempotent POST retries and recovers.

### 2. Web Push Transient Retry And Permanent Endpoint Cleanup

Before:

- A transient Web Push provider/network failure was logged once and counted as failed.
- Only 404/410 endpoint cleanup existed.

After:

- Web Push retries retryable failures:
  - network/unknown status
  - 408
  - 429
  - 5xx
- 404/410 remains non-retryable and revokes the endpoint immediately.
- Each attempt is written to notification logs with:
  - `attempt_number`
  - `retryable`
  - `final_attempt`
  - provider status code
- Subscription `failure_count` increments only after final failed delivery.
- Successful retry resets `failure_count` to zero.

Reliability impact:

- Reduces dropped browser push attempts during temporary provider instability.
- Keeps stale endpoint cleanup deterministic.
- Gives operations better delivery evidence without schema changes.

Tests added:

- Missing VAPID keys still skip safely.
- Transient 503 failure retries and succeeds.
- Permanent 410 failure does not retry and revokes the endpoint.

### 3. Background Job Retry And Audit Safety

Before:

- Job retries had no delay.
- Generated run ids could change between retry attempts when no run id was supplied.
- Failed job attempts were not audit-recorded.
- Audit-log write failure after successful job work could cause the wrapper to report failure and retry side effects.

After:

- Retry attempts share one stable run id.
- Retry attempts use bounded linear backoff.
- Failed attempts are recorded as `job.failed` audit events.
- Audit event writing is best-effort and no longer converts successful job work into a failed job result.
- Job work failures still return failed results and retry according to `maxAttempts`.

Reliability impact:

- Prevents duplicated job side effects caused by audit-log instability.
- Makes job attempts easier to correlate in logs and audit history.
- Improves background job failure evidence for monitoring.

Tests added:

- Completed job work is not retried when audit logging fails.
- Failed job work retries with stable run id and correct attempt numbers.

## Edge-Case Coverage

- Null / undefined states:
  - Web Push still skips safely when VAPID keys or recipient user id are missing.
  - Push subscription lookup still returns skipped when no active subscriptions exist.

- Race conditions / double submissions:
  - Unsafe API mutations no longer retry without idempotency.
  - Job audit failure no longer causes duplicate job side effects.

- Offline / timeout / retry handling:
  - GET and explicitly idempotent mutations keep retry recovery.
  - Non-idempotent mutations fail once and surface the error instead of duplicating writes.
  - Web Push transient failures use bounded retry.

- Background job failures:
  - Failed attempts are now audit-recorded.
  - Retries are correlated by stable run id.
  - Retry backoff is applied.

- Data consistency:
  - Successful job results are no longer invalidated by audit-write failure.
  - Push subscription failure counts represent final failed delivery, not transient attempts that later recover.

## Validation Results

Focused reliability tests:

```text
npm run test -- src/tests/unit/lib/api-client.test.ts src/tests/unit/services/web-push.service.test.ts src/tests/unit/jobs/job-runner.test.ts
Test Files  3 passed (3)
Tests       13 passed (13)
```

Full validation:

```text
npm run lint
PASS
```

```text
npm run typecheck
PASS
```

```text
npm run test
Test Files  109 passed | 3 skipped (112)
Tests       522 passed | 5 skipped (527)
```

```text
npm run test:security
Test Files  7 passed | 2 skipped (9)
Tests       69 passed | 3 skipped (72)
```

```text
npm run build
PASS
Compiled successfully
Generated static pages using 15 workers (37/37)
```

## Remaining Operational Items

- Configure shared production rate-limit storage before multi-instance production traffic.
- Complete DR drill evidence before claiming recovery readiness.
- Configure VAPID keys and service-worker registration before promising live browser push/offline behavior.
- The workspace still contains earlier phase changes outside this reliability pass.

## Final Decision

GO.

Reliability implementation is complete and validated.
