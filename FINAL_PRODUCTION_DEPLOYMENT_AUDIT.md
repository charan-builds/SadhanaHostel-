# Final Production Deployment Audit

Date: 2026-06-07

Branch: `backend-feature-migration`

Baseline: `origin/main`

Mode: production deployment audit. UI, styling, layouts, providers, navigation, homepage, and public pages were not reviewed.

## Result

NO-GO

Reason: no backend code safety blocker was found, but the deployment package is not currently an immutable clean ref. `HEAD` and `origin/backend-feature-migration` are both `798bc2a`, while the working tree contains 12 local backend/deployment hardening edits. Production deployment should not proceed until those edits are either committed and pushed with validation, or explicitly discarded and the release owner accepts deploying clean `798bc2a`.

## Audit Basis

Current git state:

- `HEAD`: `798bc2a`
- `origin/backend-feature-migration`: `798bc2a`
- `origin/main`: `d9b0f7b`
- Local tracked edits on top of `798bc2a`: 12 backend/deployment hardening files.
- Forbidden UI/provider/layout/public-page scan: PASS, no changed paths.

Validation evidence in release context:

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run test`: PASS
- `npm run test:security`: PASS
- `npm run build`: PASS

This audit did not rerun validation commands.

## P0 Findings

### P0-1: Deployment ref is not clean for the currently audited hardening state

Issue:

- The pushed deployment ref is `798bc2a`.
- The local working tree has backend hardening edits that are not committed or pushed.
- Those edits include explicit rate limits, VAPID env contract/examples, and HTTPS push endpoint validation.

Impact:

- Deploying from `origin/backend-feature-migration` omits local hardening edits.
- Deploying from the local worktree risks including untracked report files or unreviewed local state.
- Release evidence cannot be tied to one immutable production artifact.

Risk:

- High deployment packaging risk.

Exact files:

- `.env.example`
- `.env.staging.example`
- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/app/api/notices/[id]/read/route.ts`
- `src/app/api/notifications/[id]/archive/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `src/app/api/notifications/push-subscriptions/route.ts`
- `src/config/env.ts`
- `src/lib/rate-limit/rate-limit.ts`
- `src/tests/unit/lib/env-and-versioning.test.ts`
- `src/tests/unit/services/push-subscriptions.service.test.ts`
- `src/validations/pwa.validation.ts`

Required action:

- Choose one release artifact:
  - Commit and push the 12 hardening edits, then rerun `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:security`, and `npm run build`.
  - Or discard only those 12 local edits, verify a clean worktree, and deploy exactly `798bc2a`.
- Do not deploy until `git status --short` is clean except intentionally untracked local audit files.

## P1 Findings

### P1-1: Rate limiting needs production shared storage and smoke verification

Issue:

- Current working tree adds explicit policies:
  - `notifications.state_write`: 120 requests per minute.
  - `push_subscriptions.write`: 20 requests per minute.
- `assertRateLimit` uses Upstash when configured, then falls back to in-memory process-local buckets.
- The limiter fails open on backend errors to preserve availability.

Impact:

- Without Upstash in production, multi-instance/serverless throttling is not globally enforced.
- Limiter backend outages allow writes until alerts catch the fallback.

Risk:

- Medium reliability and abuse risk.

Exact files:

- `src/lib/rate-limit/rate-limit.ts`
- `.env.example`
- `.env.staging.example`
- New notification and push write API routes.

Required action:

- Set `RATE_LIMIT_ENABLED=true`.
- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Add alerting for `rate_limit.fallback_allowed`.
- Smoke test 429 behavior for notification and push subscription write routes.

### P1-2: Web Push requires VAPID and delivery smoke before launch claims

Issue:

- Web Push skips safely when VAPID keys are missing.
- Live browser push requires:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - optional `VAPID_SUBJECT` or `VAPID_CONTACT_EMAIL`
- Push delivery logs sent and failed attempts, revokes 404/410 endpoints, and masks endpoint values.

Impact:

- Missing VAPID keys will not crash the app, but browser push will not send.
- Operations can mistake stored subscriptions for confirmed push delivery.

Risk:

- Medium delivery-readiness risk.

Exact files:

- `src/services/pwa/web-push.service.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `public/sw.js`
- `src/lib/pwa/client.ts`
- `.env.example`
- `.env.staging.example`
- `src/config/env.ts`

Required action:

- Configure VAPID keys before expecting live push.
- Keep `VAPID_PRIVATE_KEY` server-only.
- Run staging smoke tests for subscribe, delivery, failed endpoint cleanup, and revoke.
- If service worker registration is not mounted in the approved product path, state that backend push storage is live but browser push/offline behavior is not yet promised.

### P1-3: Scheduler first-run behavior needs operational verification

Issue:

- Cron auth requires `CRON_SECRET`.
- `CRON_JOBS_ENABLED=false` cleanly skips scheduled execution.
- Payment reminders now run with a seven-day lookahead and `limit: 200` per organization from cron registry.
- Reminder job dedupes by template, resident, fee record, and run date.

Impact:

- First production reminder run can queue a larger resident communication batch than expected if existing due records are present.

Risk:

- Medium communication-volume risk.

Exact files:

- `src/jobs/scheduler/scheduler-auth.ts`
- `src/jobs/scheduler/vercel-cron.ts`
- `src/jobs/scheduler/cron-registry.ts`
- `src/jobs/payment-reminder.job.ts`
- `src/jobs/job-runner.ts`

Required action:

- Set and verify `CRON_SECRET`.
- Confirm `CRON_JOBS_ENABLED=true` only after staging smoke tests.
- Run payment reminder staging smoke test and capture processed/skipped counts.
- Monitor first production run for `job.started`, `job.completed`, `jobs.failed`, and `notifications.queued`.
- Keep `CRON_JOBS_ENABLED=false` ready as emergency stop.

### P1-4: Disaster Recovery is tooling-ready but not production-proven until live drill passes

Issue:

- Manual DR tooling exists for backup, database restore, storage restore, and validation.
- The runbook declares Manual DR GO only when all four commands complete and validation returns `goNoGo: "GO"`.

Impact:

- Without a completed restore drill, actual RTO/RPO and restored-data integrity are not proven.

Risk:

- Medium to high operational continuity risk.

Exact files:

- `docs/operations/manual-disaster-recovery-google-drive.md`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-dr-common.ts`

Required action:

- Before production cutover, run:
  - `npm run recovery:manual-backup`
  - `npm run recovery:manual-restore-db -- <backup-dir>`
  - `npm run recovery:manual-restore-storage -- <backup-dir>`
  - `npm run recovery:manual-validate -- <backup-dir>`
- Confirm validation reports `goNoGo: "GO"`.
- Record backup name, restore target, row counts, storage counts, signed URL checks, finance invariant results, RTO, and RPO.

### P1-5: Production monitoring and alerting must be wired externally

Issue:

- The application emits structured logs and in-process metrics.
- In-process metrics are not durable across serverless invocations or restarts.

Impact:

- Rate-limit fallback, job failures, push failures, notification spikes, and cron auth problems may be missed without external ingestion.

Risk:

- Medium observability risk.

Exact files:

- `src/lib/metrics/metrics.ts`
- `src/lib/logger/logger.ts`
- `src/lib/logger/error-logger.ts`
- `src/jobs/job-runner.ts`
- `src/jobs/scheduler/vercel-cron.ts`
- `src/services/pwa/web-push.service.ts`
- `src/services/notifications/notification.service.ts`

Required action:

- Send stdout/stderr structured logs to production log ingestion.
- Alert on:
  - `application.error`
  - `job.failed`
  - `cron.auth.missing_secret`
  - `cron.auth.denied`
  - `rate_limit.fallback_allowed`
  - Web Push `notification_logs.status = failed`
  - abnormal `notifications.queued` volume.

## P2 Findings

### P2-1: Web Push transient retry is not implemented

Issue:

- Non-404/410 Web Push failures are logged and increment `failure_count`, but are not retried.

Impact:

- Browser push can be missed during transient push-provider or network failures.
- In-app notification remains the durable notification record.

Risk:

- Low to medium.

Exact files:

- `src/services/pwa/web-push.service.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/repositories/notifications.repository.ts`

Recommended improvement:

- Add bounded retry/backoff for transient Web Push failures after launch if browser push becomes launch-critical.

### P2-2: Rollback is forward-only/manual after production writes

Issue:

- Migrations are additive and safe, but there are no down migrations.
- After production writes begin, removing new tables/columns requires data-retention decisions.

Impact:

- Rollback must preserve new schema or use forward corrective migrations.

Risk:

- Low to medium.

Exact files:

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

Recommended improvement:

- Keep application rollback as the first rollback path.
- Use forward corrective migrations after production writes begin.
- Do not drop new data structures without product and operations signoff.

## Environment Variables

Required runtime:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RATE_LIMIT_ENABLED`
- `CRON_JOBS_ENABLED`
- `CRON_SECRET`
- `NOTIFICATIONS_SEND_ENABLED`

Rate limiting:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Web Push:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- Optional `VAPID_SUBJECT`
- Optional `VAPID_CONTACT_EMAIL`

Disaster Recovery:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MANUAL_DR_GOOGLE_DRIVE_REMOTE` or `GOOGLE_DRIVE_BACKUP_REMOTE`
- `GOOGLE_DRIVE_BACKUP_ACCOUNT_EMAIL`
- `RESTORE_DATABASE_URL`
- `RESTORE_SUPABASE_URL`
- `RESTORE_SUPABASE_SERVICE_ROLE_KEY`

## Migration Ordering

Apply in timestamp order:

1. `supabase/migrations/20260606001000_resident_notice_reads.sql`
2. `supabase/migrations/20260606002000_smart_notification_center.sql`
3. `supabase/migrations/20260606003000_notice_acknowledgements.sql`
4. `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

Status:

- Ordering: PASS.
- Idempotency: PASS for new tables, columns, indexes, policy replacement, and trigger replacement.
- Indexes: PASS.
- RLS enforcement: PASS on new tenant-owned tables.
- Destructive SQL: PASS, no `drop table`, `drop column`, `delete from`, or `truncate` found in the new migrations.

## Database Safety And RLS

Status: PASS

- `notice_reads`
  - Unique key on `(notice_id, resident_id)`.
  - Organization, notice, and resident indexes exist.
  - RLS enabled and forced.
  - Policies allow Owner/Admin management or linked resident ownership.
- `notice_acknowledgements`
  - Unique key on `(notice_id, resident_id)`.
  - Organization, notice, and resident indexes exist.
  - RLS enabled and forced.
  - Policies allow Owner/Admin management or linked resident ownership.
- `notifications`
  - Category, priority, archive fields are additive.
  - Center/unread/archive indexes exist.
  - Existing RLS remains in place.
- `push_subscriptions`
  - HTTPS endpoint check constraint exists.
  - Non-negative failure count check exists.
  - Unique endpoint constraint exists.
  - Active user/resident/hostel indexes exist.
  - RLS enabled and forced.
  - Insert requires `auth.uid() = user_id` and organization membership.

## Notification Safety

Status: PASS with monitoring prerequisite

- Notification archive is scoped by organization and current `recipient_user_id`.
- Notice read and acknowledgement service paths enforce organization access, resident linkage, notice lookup, and audience targeting.
- Web Push delivery is skipped safely when VAPID config is missing.
- Web Push failures create notification log rows.
- 404/410 endpoints are revoked.
- Payment reminders dedupe by template, resident, fee record, and run date.

Production prerequisite:

- Monitor first reminder run and Web Push failure logs.

## Rollback Readiness

Status: REVIEW

Preferred rollback order:

1. Roll application code back to previous production commit.
2. Leave additive schema in place if production writes have occurred.
3. Use a forward corrective migration if code/schema mismatch needs repair.
4. Restore from verified pre-deploy backup only if data side effects must be removed.

Do not:

- Drop `notice_reads`, `notice_acknowledgements`, or `push_subscriptions` after production writes without a data-retention decision.

## Deployment Checklist

Before deploy:

- Resolve P0 release-ref issue.
- Verify production backup or complete manual DR backup.
- Apply migrations in order.
- Configure rate-limit Upstash env.
- Configure VAPID keys if live Web Push is expected.
- Verify `CRON_SECRET`.
- Keep `CRON_JOBS_ENABLED=false` until staging smoke tests are accepted.

After deploy:

- Run staging smoke plan against production-like environment before production traffic.
- Confirm notice read and acknowledgement.
- Confirm notification archive.
- Confirm push subscribe, delivery, and revoke.
- Confirm payment reminder job controlled execution.
- Confirm owner analytics and support operational alerts.
- Monitor logs and notification volume.

## Final Decision

NO-GO

No backend schema, RLS, authorization, or build-compatibility blocker was found. The deployment is blocked because the current audited state is not a clean immutable deployment artifact. Resolve P0-1, rerun validation, then this release can move to GO if no new blockers appear.
