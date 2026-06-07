# Production Launch Checklist

Date: 2026-06-07

Branch: `backend-feature-migration`

Mode: production deployment-day checklist. This is a checklist artifact only; no source code, migrations, UI, layouts, providers, styling, images, translations, public pages, resident UI, finance UI, or navigation files were modified.

## Launch Status

Current status: NOT READY

Reason:

- Required deployment-day boxes are not yet completed.
- Current workspace has local hardening edits and untracked report artifacts; deploy only from a clean pushed git ref.
- DR recovery signoff remains NO-GO until a full backup, isolated restore, storage restore, and validation drill passes.

This status becomes LAUNCH READY only when every required pre-deploy, deploy, validation, smoke-test, and post-deploy monitoring checkbox below is completed or explicitly accepted by the release owner.

## Release Metadata

- [ ] Release owner assigned.
- [ ] Incident commander assigned.
- [ ] Database operator assigned.
- [ ] Application deploy operator assigned.
- [ ] QA smoke-test owner assigned.
- [ ] Monitoring/logging owner assigned.
- [ ] Rollback owner assigned.
- [ ] Release window approved.
- [ ] Stakeholders notified.
- [ ] Production change ticket created.
- [ ] Final release SHA recorded: `____________________________`
- [ ] Production platform target recorded: `____________________________`
- [ ] Supabase production project ref recorded: `____________________________`
- [ ] Backup directory name recorded: `____________________________`

## Pre-Deploy

### 1. Release Package Verification

- [ ] Confirm deployment source is a clean pushed git ref, not the dirty local worktree.
- [ ] Confirm release branch is `backend-feature-migration` or merged production branch.
- [ ] Confirm release SHA is the intended backend release SHA.
- [ ] Confirm no untracked audit/report files are included in the release package.
- [ ] Confirm no excluded UI, layout, provider, public page, resident UI, finance UI, translation, image, styling, branding, or navigation paths are in the release diff.
- [ ] Confirm local hardening edits are either committed and pushed or intentionally excluded.
- [ ] Run:

```bash
git status --short --branch
git diff --name-only origin/main..HEAD
```

- [ ] Confirm changed files are limited to approved backend, migrations, PWA core, push, DR tooling, package, and backend/security test scope.

### 2. Backup Verification

- [ ] Confirm `DATABASE_URL` points to production source database.
- [ ] Confirm `NEXT_PUBLIC_SUPABASE_URL` points to production source project.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is production source service-role key.
- [ ] Confirm Google Drive remote is configured.
- [ ] Confirm Google Drive backup account is the approved account.
- [ ] Confirm backup output directory is not inside tracked git files.
- [ ] Run:

```bash
npm run recovery:manual-backup
```

- [ ] Confirm backup command exits successfully.
- [ ] Confirm backup directory exists under `.manual-dr-backups/`.
- [ ] Confirm `database.sql` exists.
- [ ] Confirm `backup-manifest.json` exists.
- [ ] Confirm `backup-manifest.sha256` exists.
- [ ] Confirm manifest includes database row counts.
- [ ] Confirm manifest includes storage object counts.
- [ ] Confirm manifest includes storage checksums.
- [ ] Confirm Google Drive upload completed.
- [ ] Confirm remote `backup-manifest.json` is visible in Google Drive.
- [ ] Record backup duration: `____________________________`
- [ ] Record expected RPO from latest successful backup: `____________________________`

### 3. Restore Drill Verification

- [ ] Confirm `RESTORE_DATABASE_URL` points to an isolated restore database, never production.
- [ ] Confirm `RESTORE_SUPABASE_URL` points to an isolated restore Supabase project, never production.
- [ ] Confirm `RESTORE_SUPABASE_SERVICE_ROLE_KEY` belongs to the isolated restore project.
- [ ] Confirm restore target project ref differs from production project ref.
- [ ] Confirm restore database host/project differs from production database.
- [ ] Run:

```bash
npm run recovery:manual-restore-db -- <backup-dir>
npm run recovery:manual-restore-storage -- <backup-dir>
npm run recovery:manual-validate -- <backup-dir>
```

- [ ] Confirm database restore exits successfully.
- [ ] Confirm storage restore exits successfully.
- [ ] Confirm validation exits successfully.
- [ ] Confirm validation output includes `goNoGo: "GO"`.
- [ ] Confirm restored database row counts match backup manifest.
- [ ] Confirm restored storage object counts match backup manifest.
- [ ] Confirm signed URL checks pass.
- [ ] Confirm finance invariant checks pass.
- [ ] Record database restore duration: `____________________________`
- [ ] Record storage restore duration: `____________________________`
- [ ] Record validation duration: `____________________________`
- [ ] Record measured RTO: `____________________________`

### 4. Environment Verification

- [ ] `NEXT_PUBLIC_APP_URL` points to production app URL.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` points to production Supabase URL.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is production anon key.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is production service-role key and server-only.
- [ ] `NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID` is production organization id.
- [ ] `NEXT_PUBLIC_DEFAULT_HOSTEL_ID` is production hostel id.
- [ ] `RATE_LIMIT_ENABLED=true`.
- [ ] `UPSTASH_REDIS_REST_URL` is set for production.
- [ ] `UPSTASH_REDIS_REST_TOKEN` is set for production and server-only.
- [ ] `CRON_JOBS_ENABLED` value is confirmed for launch plan.
- [ ] `CRON_SECRET` is set and server-only.
- [ ] `NOTIFICATIONS_SEND_ENABLED` value is confirmed for launch plan.
- [ ] `LOG_LEVEL=info` or stricter production value is set.
- [ ] No placeholder or staging values are present in production environment.
- [ ] Required secrets are stored in deployment platform secret manager.
- [ ] No secrets are committed in git.
- [ ] Run staging/prod env audit if available:

```bash
npm run release:staging:preflight -- --strict
npm run release:production:hardening
```

- [ ] Confirm env audit results are acceptable for launch.

### 5. VAPID Verification

- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set if live browser push is expected.
- [ ] `VAPID_PRIVATE_KEY` is set if live browser push is expected.
- [ ] `VAPID_PRIVATE_KEY` is server-only.
- [ ] `VAPID_SUBJECT` or `VAPID_CONTACT_EMAIL` is set to a valid contact value.
- [ ] Public and private VAPID keys are a matching pair.
- [ ] Staging Web Push delivery has been smoke tested with these key types.
- [ ] If VAPID keys are intentionally absent, release owner accepts that browser push delivery will skip gracefully.

### 6. Upstash Verification

- [ ] Upstash Redis REST URL is reachable from production runtime.
- [ ] Upstash Redis REST token has correct permissions.
- [ ] Rate limiting does not fall back to process-local memory in production.
- [ ] Alert exists for `rate_limit.fallback_allowed`.
- [ ] 429 behavior has been smoke tested for notification state writes.
- [ ] 429 behavior has been smoke tested for push subscription writes.

### 7. Migration Verification

- [ ] Confirm migration files exist:
  - [ ] `supabase/migrations/20260606001000_resident_notice_reads.sql`
  - [ ] `supabase/migrations/20260606002000_smart_notification_center.sql`
  - [ ] `supabase/migrations/20260606003000_notice_acknowledgements.sql`
  - [ ] `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`
- [ ] Confirm migrations are applied in timestamp order.
- [ ] Confirm migrations are additive.
- [ ] Confirm no destructive data SQL is present.
- [ ] Confirm new tables enable and force RLS.
- [ ] Confirm indexes exist for notice reads, acknowledgements, notification center views, and push subscriptions.
- [ ] Confirm migration execution operator has required database access.
- [ ] Confirm production backup is complete before migration execution.

### 8. Final Pre-Deploy Validation

- [ ] Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:security
npm run build
```

- [ ] Confirm `npm run lint` passes.
- [ ] Confirm `npm run typecheck` passes.
- [ ] Confirm `npm run test` passes.
- [ ] Confirm `npm run test:security` passes.
- [ ] Confirm `npm run build` passes.
- [ ] Save validation output location: `____________________________`

## Deploy

### 1. Exact Deployment Sequence

- [ ] Freeze production writes if release owner requires a quiet migration window.
- [ ] Confirm backup and restore drill boxes are complete.
- [ ] Confirm release SHA is clean and pushed.
- [ ] Confirm production environment variables are set.
- [ ] Confirm monitoring dashboards are open.
- [ ] Confirm rollback owner is on standby.
- [ ] Apply production migrations in order:

```text
1. supabase/migrations/20260606001000_resident_notice_reads.sql
2. supabase/migrations/20260606002000_smart_notification_center.sql
3. supabase/migrations/20260606003000_notice_acknowledgements.sql
4. supabase/migrations/20260606004000_pwa_push_subscriptions.sql
```

- [ ] Verify migration 1 completed.
- [ ] Verify migration 2 completed.
- [ ] Verify migration 3 completed.
- [ ] Verify migration 4 completed.
- [ ] Deploy application from release SHA.
- [ ] Confirm deployment finished without build/runtime errors.
- [ ] Confirm deployed SHA matches release SHA.
- [ ] Confirm production app boots.
- [ ] Confirm no unexpected 500 responses immediately after boot.
- [ ] Re-enable production writes if they were paused.

### 2. Validation Sequence

- [ ] Confirm database tables exist:
  - [ ] `notice_reads`
  - [ ] `notice_acknowledgements`
  - [ ] `push_subscriptions`
- [ ] Confirm smart notification columns exist:
  - [ ] `category`
  - [ ] `priority`
  - [ ] `archived_at`
  - [ ] `archived_by`
- [ ] Confirm notice acknowledgement columns exist:
  - [ ] `notice_type`
  - [ ] `requires_acknowledgement`
- [ ] Confirm RLS is enabled and forced on new tables.
- [ ] Confirm required indexes exist.
- [ ] Confirm app health endpoint or homepage responds as expected.
- [ ] Confirm authenticated API requests succeed.
- [ ] Confirm unauthorized API requests are denied.
- [ ] Confirm logs show no migration-related runtime errors.

### 3. Smoke-Test Sequence

Run backend smoke tests in this order:

1. Notice read
   - [ ] Targeted resident can mark an eligible notice as read.
   - [ ] Non-targeted resident is denied.
   - [ ] Duplicate read does not create duplicate state.

2. Notice acknowledgement
   - [ ] Targeted resident can acknowledge an acknowledgement-required notice.
   - [ ] Non-targeted resident is denied.
   - [ ] Non-acknowledgement notice cannot be acknowledged as required.

3. Notification archive
   - [ ] Current recipient can archive their notification.
   - [ ] User cannot archive another recipient's notification.

4. Push subscription create
   - [ ] Authenticated user can create a valid HTTPS push subscription.
   - [ ] Invalid or non-HTTPS endpoint is rejected if hardening edits are included.
   - [ ] Subscription is scoped to current user and organization.

5. Push subscription revoke
   - [ ] Current user can revoke their own subscription.
   - [ ] Current user cannot revoke another user's subscription.

6. Web Push delivery
   - [ ] Delivery skips gracefully if VAPID keys are intentionally absent.
   - [ ] Delivery succeeds when VAPID keys are configured.
   - [ ] 404/410 endpoint cleanup revokes invalid subscriptions.
   - [ ] Failed attempts create notification log records.

7. Payment reminder execution
   - [ ] Staged execution processes expected due records.
   - [ ] Duplicate prevention works for same template, resident, fee record, and run date.
   - [ ] Queued notification count is within expected launch range.

8. Analytics metrics
   - [ ] Authorized owner/admin can load communication metrics.
   - [ ] Unauthorized user is denied.
   - [ ] Existing analytics responses remain backward compatible.

9. Resident profile enrichment
   - [ ] Resident with active room allocation receives room fields.
   - [ ] Resident without active room allocation receives null room fields.
   - [ ] Existing resident fields remain present.

10. Support operational alerts
   - [ ] Owner/Admin can load operational alerts.
   - [ ] Unauthorized roles are denied.
   - [ ] Aggregate reads do not fail because of request-scoped RLS.

## Post-Deploy

### 1. Monitoring Checks

- [ ] Open application logs.
- [ ] Open database logs.
- [ ] Open Supabase auth logs.
- [ ] Open scheduled job logs.
- [ ] Open notification delivery logs.
- [ ] Open rate-limit logs.
- [ ] Confirm no elevated `application.error` events.
- [ ] Confirm no unexpected 500 spikes.
- [ ] Confirm latency is within normal range.
- [ ] Confirm database CPU and connection usage are within normal range.
- [ ] Confirm no RLS policy errors are spiking.

### 2. Error Checks

- [ ] Check for `job.failed`.
- [ ] Check for `cron.auth.missing_secret`.
- [ ] Check for `cron.auth.denied`.
- [ ] Check for `rate_limit.fallback_allowed`.
- [ ] Check for Web Push provider failures.
- [ ] Check for notification repository write failures.
- [ ] Check for migration-related schema errors.
- [ ] Check for validation parsing errors in new API routes.
- [ ] Check for unexpected auth/session errors.

### 3. Notification Checks

- [ ] Notice read records are being written only for targeted residents.
- [ ] Notice acknowledgement records are being written only for targeted residents.
- [ ] Notification archive records are scoped to current recipient.
- [ ] Notification category and priority values are populated.
- [ ] Archived notifications are excluded from unread notification center views.
- [ ] Web Push failure count is not rising unexpectedly.
- [ ] Invalid endpoints are revoked.
- [ ] Notification volume is within expected launch range.

### 4. Scheduler Checks

- [ ] Confirm `CRON_JOBS_ENABLED` value matches launch plan.
- [ ] Confirm `CRON_SECRET` authentication succeeds.
- [ ] Confirm scheduled jobs do not run unexpectedly before smoke testing is complete.
- [ ] Confirm payment reminder job starts at expected time.
- [ ] Confirm payment reminder job completes successfully.
- [ ] Confirm processed/skipped counts are expected.
- [ ] Confirm duplicate reminders are not created.
- [ ] If abnormal volume appears, set `CRON_JOBS_ENABLED=false` and escalate.

### 5. Analytics Checks

- [ ] Owner analytics endpoint returns expected communication metrics.
- [ ] Notice read rates are present when relevant data exists.
- [ ] Acknowledgement rates are present when relevant data exists.
- [ ] Fee reminder engagement metrics are present when relevant data exists.
- [ ] Existing analytics fields remain present.
- [ ] Unauthorized analytics access is denied.

### 6. DR And Backup Follow-Up

- [ ] Confirm post-deploy backup schedule is active.
- [ ] Confirm latest backup freshness is inside RPO target.
- [ ] Confirm backup failure alert is active.
- [ ] Confirm restore target credentials remain available.
- [ ] Confirm DR evidence from launch is stored in the approved location.

### 7. Release Closure

- [ ] Record deployed SHA.
- [ ] Record migration completion time.
- [ ] Record smoke-test completion time.
- [ ] Record post-deploy monitoring window start and end.
- [ ] Record any incidents or anomalies.
- [ ] Confirm release owner signs off.
- [ ] Notify stakeholders release is complete.

## Rollback Checklist

Use this only if a release-blocking production failure occurs.

- [ ] Declare rollback owner.
- [ ] Stop or disable scheduler if notification/job volume is abnormal.
- [ ] Roll application code back to previous production SHA.
- [ ] Leave additive migrations in place unless database restore is explicitly required.
- [ ] If production data writes occurred, prefer forward corrective migration over dropping new tables/columns.
- [ ] Restore database from pre-deploy backup only if approved by release owner and database operator.
- [ ] Preserve `notice_reads`, `notice_acknowledgements`, and `push_subscriptions` data until retention decision is made.
- [ ] Record rollback start time.
- [ ] Record rollback completion time.
- [ ] Run critical smoke tests after rollback.
- [ ] Notify stakeholders.

## Final Launch Gate

Launch can be marked ready only when all required boxes are complete:

- [ ] Release package is clean.
- [ ] Production backup is complete.
- [ ] Isolated restore drill passed.
- [ ] Environment variables are verified.
- [ ] VAPID posture is verified.
- [ ] Upstash rate limiting is verified.
- [ ] Migrations are verified.
- [ ] Full validation gate passed.
- [ ] Production deployment completed.
- [ ] Backend smoke tests passed.
- [ ] Post-deploy monitoring checks passed.
- [ ] Release owner signed off.

## Final Status

NOT READY
