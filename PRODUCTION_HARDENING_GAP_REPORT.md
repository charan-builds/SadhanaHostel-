# Production Hardening Gap Report

Date: 2026-06-07

Branch: `backend-feature-migration`

Baseline: `origin/main`

Mode: production-hardening audit only. No UI, styling, branding, navigation, layouts, providers, public pages, resident UI, or finance UI were reviewed or modified. This report is the only file created for this request.

## Audit Scope

Focus areas:

- Stability
- Reliability
- Observability
- Monitoring
- Error handling
- Database safety
- Rate limiting
- Background jobs
- Notification delivery
- Disaster recovery

## Audit Basis

Current branch state:

- `HEAD`: `798bc2a`
- `origin/backend-feature-migration`: `798bc2a`
- `origin/main`: `d9b0f7b`
- Current working tree has 12 local backend/deployment hardening edits on top of `798bc2a`.

Tracked diff against `origin/main`:

- 76 changed paths.
- Forbidden UI/provider/layout/public/resident/finance path scan: PASS, no matching paths.

Validation status from the current release context:

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run test`: PASS
- `npm run test:security`: PASS
- `npm run build`: PASS

## Executive Summary

No P0 production blockers were found.

The backend code path is broadly production-safe: migrations are additive and RLS-protected, write APIs have validation and service authorization, notice read/acknowledgement now enforce audience targeting, push subscriptions are user-scoped, and background jobs have idempotency keys and job-runner logging.

The remaining gaps are operational hardening and release packaging:

- Current hardening edits are local and not in pushed commit `798bc2a`.
- Rate limiting should use shared production storage, not process-local fallback.
- Manual DR is not production GO until a backup, isolated restore, storage restore, and validation drill complete.
- First production runs for payment reminders and push delivery need monitoring.
- Existing metrics are useful in process/logs, but production needs external log/alert wiring.

## P0 Findings

None.

## P1 Findings

### P1-1: Local hardening edits are not committed or pushed

Issue:

- The current working tree includes production hardening edits that are not part of pushed commit `798bc2a`.
- These edits add explicit rate limits, VAPID env contract/examples, and HTTPS push endpoint validation.

Impact:

- Deploying exactly `origin/backend-feature-migration` at `798bc2a` will omit those hardening improvements.
- Deploying from the dirty local worktree risks packaging untracked report files or unreviewed local state.

Risk:

- Medium release-packaging risk.

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

Exact recommended fix:

- Decide whether these 12 files are part of the release package.
- If yes, commit them, rerun the full validation gate, and push the cleaned branch.
- If no, discard only these local hardening edits and deploy from clean `798bc2a`.
- Do not deploy from an unclean local worktree.

### P1-2: Production rate limiting depends on shared storage configuration

Issue:

- New write routes now use explicit policies:
  - `notifications.state_write`: 120 requests per minute.
  - `push_subscriptions.write`: 20 requests per minute.
- `assertRateLimit` uses Upstash when configured, but falls back to process-local memory when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are absent.
- The limiter fails open on limiter errors to preserve availability.

Impact:

- In a multi-instance or serverless production runtime, process-local fallback does not enforce a global tenant/user limit.
- Failed limiter storage can allow abusive notification-state or push-subscription churn until monitoring catches it.

Risk:

- Medium reliability and abuse-risk gap.

Exact files:

- `src/lib/rate-limit/rate-limit.ts`
- `src/app/api/notices/[id]/read/route.ts`
- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/app/api/notifications/[id]/archive/route.ts`
- `src/app/api/notifications/push-subscriptions/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `.env.example`
- `.env.staging.example`

Exact recommended fix:

- Set `RATE_LIMIT_ENABLED=true` in production.
- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Add an operational alert on structured log event `rate_limit.fallback_allowed`.
- Smoke test 429 behavior for both new policies before production traffic.

### P1-3: Manual DR tooling exists, but production recovery is not proven until a live drill passes

Issue:

- The branch adds manual backup, restore, storage restore, and validation tooling.
- The runbook itself states Manual DR is GO only after backup, isolated DB restore, storage restore, and validation complete.

Impact:

- Without a successful drill, actual RTO/RPO are unknown.
- Database backup may exist without proven storage restore, signed URL access, or finance invariant validation.

Risk:

- Medium to high operational continuity risk.

Exact files:

- `docs/operations/manual-disaster-recovery-google-drive.md`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-dr-common.ts`

Exact recommended fix:

- Before production launch, run:
  - `npm run recovery:manual-backup`
  - `npm run recovery:manual-restore-db -- <backup-dir>`
  - `npm run recovery:manual-restore-storage -- <backup-dir>`
  - `npm run recovery:manual-validate -- <backup-dir>`
- Confirm `goNoGo: "GO"` from validation.
- Record the backup name, restore target, row counts, storage counts, signed URL checks, and RTO/RPO timings.

### P1-4: Payment reminder first-run volume needs staging verification and production monitoring

Issue:

- Payment reminders now scan up to 200 due records per organization with a seven-day lookahead.
- Each processed resident can receive in-app and WhatsApp reminder queue entries.
- Deduplication exists by template, resident, fee record, and run date, but first-run volume still depends on live data.

Impact:

- The first production run could create more resident communications than expected if historical due records are present.
- A bad scheduler configuration could amplify notification volume.

Risk:

- Medium notification-volume and resident-experience risk.

Exact files:

- `src/jobs/payment-reminder.job.ts`
- `src/jobs/scheduler/cron-registry.ts`
- `src/jobs/job-runner.ts`
- `src/repositories/notifications.repository.ts`

Exact recommended fix:

- Run the payment reminder job in staging with production-like data.
- Capture processed/skipped counts and queued notification counts.
- For first production execution, monitor `job.started`, `job.completed`, `jobs.failed`, `notifications.queued`, and notification log entries.
- Keep `CRON_JOBS_ENABLED=false` available as the emergency stop if counts are abnormal.

### P1-5: Production monitoring needs external log and alert wiring

Issue:

- The app emits structured logs and in-process metrics.
- `src/lib/metrics/metrics.ts` stores counters/timings in memory and logs metric events at debug level.
- In-memory metrics are not durable across serverless invocations or process restarts.

Impact:

- Without external log/metric ingestion, rate-limit fallbacks, job failures, push failures, and notification volume spikes can be missed.

Risk:

- Medium observability gap.

Exact files:

- `src/lib/metrics/metrics.ts`
- `src/lib/logger/logger.ts`
- `src/lib/logger/error-logger.ts`
- `src/jobs/job-runner.ts`
- `src/jobs/scheduler/vercel-cron.ts`
- `src/services/pwa/web-push.service.ts`
- `src/services/notifications/notification.service.ts`

Exact recommended fix:

- Configure production log ingestion for stdout/stderr structured logs.
- Alert on:
  - `application.error`
  - `job.failed`
  - `cron.auth.missing_secret`
  - `cron.auth.denied`
  - `rate_limit.fallback_allowed`
  - Web Push notification logs with `status = failed`
  - sudden spikes in `notifications.queued`
- Keep `LOG_LEVEL=info` in production and temporarily raise to `debug` only during controlled investigations.

### P1-6: Live Web Push delivery requires explicit deployment readiness

Issue:

- Web Push gracefully skips delivery when VAPID keys are missing.
- That prevents crashes, but it also means live browser push will silently not send until VAPID keys are configured.
- Browser push also requires a registered service worker; the PWA client helper exists but provider/layout mounting was intentionally excluded.

Impact:

- In-app notifications remain available, but browser push/offline behavior may not activate.
- Operations could mistake saved subscriptions for confirmed push delivery.

Risk:

- Medium delivery-readiness risk if live browser push is expected at launch.

Exact files:

- `src/services/pwa/web-push.service.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `public/sw.js`
- `src/lib/pwa/client.ts`
- `.env.example`
- `.env.staging.example`
- `src/config/env.ts`

Exact recommended fix:

- Configure `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in staging and production before expecting live push.
- Keep `VAPID_PRIVATE_KEY` server-only.
- Confirm service worker registration exists in the approved product path before promising browser push/offline behavior.
- Smoke test subscribe, delivery, 404/410 endpoint cleanup, and revoke in staging.

## P2 Findings

### P2-1: Web Push transient failures are logged but not retried

Issue:

- Web Push failures increment subscription `failure_count` and create a notification log.
- 404/410 endpoints are revoked.
- Transient provider/network failures are not retried automatically.

Impact:

- A transient delivery outage can drop browser push attempts for otherwise valid in-app notifications.

Risk:

- Low to medium reliability gap because in-app notifications remain the source of truth.

Exact files:

- `src/services/pwa/web-push.service.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/repositories/notifications.repository.ts`

Exact recommended fix:

- After launch, add a bounded retry/backoff path for non-404/410 Web Push failures.
- Until then, monitor `notification_logs` where `provider = 'web-push'` and `status = 'failed'`.

### P2-2: Room and role notice audiences fail closed in service helper

Issue:

- `noticeTargetsResident` supports `all`, `hostel`, and selected `residents`.
- Unsupported audience types return false.
- This is safe for authorization but can block read/acknowledgement/fanout if room or role audiences are later used.

Impact:

- Room/role targeted notices may not reach or be readable by intended residents through the new service paths.

Risk:

- Low for this release if production uses only all-hostel and selected-resident notices.
- Medium if room/role targeting is enabled operationally.

Exact files:

- `src/lib/notices/audience.ts`
- `src/services/notices.service.ts`
- `src/jobs/scheduled-notices.job.ts`

Exact recommended fix:

- Keep production notice audiences limited to `all`, `hostel`, and selected residents until room/role targeting is implemented.
- If room/role targeting is needed, implement and test those branches in `noticeTargetsResident` before enabling them.

### P2-3: PWA core files are present, but runtime registration remains a separate product decision

Issue:

- `public/sw.js`, manifest updates, icon route, and client helper exist.
- The current backend-focused release intentionally avoids provider/layout mounting.

Impact:

- PWA install/offline behavior may not activate automatically even though PWA core files exist.

Risk:

- Low for backend launch.
- Medium if install/offline behavior is part of launch acceptance.

Exact files:

- `public/sw.js`
- `src/lib/pwa/client.ts`
- `src/app/manifest.ts`
- `src/app/pwa-icon/[size]/route.tsx`
- `next.config.ts`

Exact recommended fix:

- Treat service worker mounting as a separate approved product integration.
- For this backend release, document that PWA core is staged and browser install/offline behavior requires approved registration.

### P2-4: Migration rollback is forward-only/manual

Issue:

- New migrations are additive and safe, but no down migrations exist.
- After production writes begin, removing new tables or columns requires data-retention decisions.

Impact:

- Rollback requires either application rollback with schema left in place, a forward corrective migration, or database restore from backup.

Risk:

- Low to medium database operations risk.

Exact files:

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

Exact recommended fix:

- Take or verify a production backup before applying migrations.
- Apply migrations in timestamp order.
- Use application rollback plus forward corrective migrations after production writes begin.
- Do not drop new tables/columns without product and operations signoff.

## Positive Hardening Findings

### Database Safety

- New schema changes are additive.
- New tables use `create table if not exists`.
- New columns use `add column if not exists`.
- New indexes use `create index if not exists`.
- RLS is enabled and forced on `notice_reads`, `notice_acknowledgements`, and `push_subscriptions`.
- No destructive SQL was found in the new migrations: no `drop table`, `drop column`, `delete from`, or `truncate`.

### Rate Limiting

- Current working tree adds explicit rate limits to notice read, acknowledgement, archive, push subscribe, and push revoke routes.
- Shared route wrapper applies same-origin mutation protection and optional rate limiting before service execution.
- 429 metrics are incremented when limits are hit.

### Error Handling

- API routes use `withApiRoute`, request IDs, error normalization, request logging, and latency metrics.
- Background jobs record job events, metrics, and structured logs.
- Web Push missing-key configuration degrades safely by skipping delivery.
- Web Push endpoint values are masked in provider logs.

### Notification Delivery

- Notification queueing records metrics.
- Web Push logs sent and failed attempts to `notification_logs`.
- 404/410 Web Push endpoints are revoked.
- Push subscriptions are protected by HTTPS validation and database constraints.

### Disaster Recovery

- DR scripts validate required environment variables.
- Restore scripts refuse to restore into the source database target.
- Backup manifests include row counts, storage object counts, checksums, Google Drive verification, and RTO/RPO fields.
- Validation checks row counts, storage object counts, signed URL access, and finance invariants.

## Prioritized Execution Plan

1. Resolve release packaging drift:
   - Commit and push the 12 local hardening edits or discard them.
   - Rerun `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:security`, and `npm run build`.
   - Deploy only from a clean pushed git ref.

2. Configure production throttling:
   - Set `RATE_LIMIT_ENABLED=true`.
   - Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   - Smoke test rate-limit behavior on notification and push write routes.

3. Complete DR proof:
   - Run manual backup, isolated DB restore, storage restore, and validation.
   - Confirm `goNoGo: "GO"`.
   - Record RTO/RPO evidence.

4. Prepare notification and job monitoring:
   - Wire structured logs to production log ingestion.
   - Add alerts for job failures, cron auth failures, rate-limit fallback, Web Push failures, and notification-volume spikes.

5. Stage live delivery smoke tests:
   - Configure VAPID keys in staging.
   - Test push subscribe, delivery, endpoint cleanup, revoke, notice read, notice acknowledgement, notification archive, and payment reminder dry run.

6. Defer P2 improvements unless they become launch requirements:
   - Web Push retry/backoff.
   - Room/role notice targeting.
   - PWA service worker mounting.
   - Formal down/rollback migrations.

## GO / NO-GO

GO

No P0 production blockers were found. The backend release can proceed once the P1 operational and packaging actions above are completed or explicitly accepted by the release owner.
