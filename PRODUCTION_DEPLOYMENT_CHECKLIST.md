# Production Deployment Checklist

Date: 2026-06-07

Branch: `backend-feature-migration`

Scope: backend notices, acknowledgements, smart notifications, push subscriptions, Web Push, PWA core, analytics backend, resident enrichment, support permission fix, payment reminders, and DR tooling.

## Release Scope

- No UI, layout, provider, public-page, resident dashboard, finance UI, styling, translation, image, branding, animation, or navigation changes are part of this checklist.
- Production code changes are limited to backend routes, services, repositories, validations, migrations, PWA core files, push infrastructure, analytics/resident/support backend code, DR tooling, and backend/security tests.

## Migration Order

Run migrations in timestamp order:

1. `supabase/migrations/20260606001000_resident_notice_reads.sql`
2. `supabase/migrations/20260606002000_smart_notification_center.sql`
3. `supabase/migrations/20260606003000_notice_acknowledgements.sql`
4. `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

Expected schema changes:

- `notice_reads` table with tenant/hostel/resident scope, indexes, forced RLS, and read-upsert support.
- Smart notification columns and indexes for category, priority, and archived state.
- `notice_acknowledgements` table plus notice type and acknowledgement-required columns.
- `push_subscriptions` table with HTTPS endpoint constraint, active-subscription indexes, and forced RLS.

## Pre-Deploy Backup

- Confirm the latest production database backup exists and is restorable.
- Capture or verify a fresh backup immediately before applying migrations.
- Confirm the restore target and credentials are not production:
  - `RESTORE_DATABASE_URL`
  - `RESTORE_SUPABASE_URL`
  - `RESTORE_SUPABASE_SERVICE_ROLE_KEY`
- Confirm DR tools are available on the operator machine:
  - `pg_dump`
  - `psql`
  - `rclone`

## Migration Safety Checks

- Verify all four migrations are present before deploy.
- Apply migrations once, in order.
- Confirm no destructive SQL is present:
  - No `drop table`
  - No `drop column`
  - No `delete from`
  - No `truncate`
- Confirm policy/trigger replacement statements only replace migration-owned policies/triggers.
- Confirm RLS remains enabled and forced on:
  - `notice_reads`
  - `notice_acknowledgements`
  - `push_subscriptions`

## Rollback Strategy

- Treat rollback as forward-only after production writes begin.
- If deployment is stopped before traffic reaches new code, restore from the pre-deploy database backup if needed.
- If traffic has reached new code, prefer a forward corrective migration over deleting new tables or columns.
- Do not remove new tables or columns until data retention and dependent code have been reviewed.

## VAPID Setup

Required for live browser push delivery:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Optional sender identity:

- `VAPID_SUBJECT`
- `VAPID_CONTACT_EMAIL`

Notes:

- Web Push delivery skips safely when required VAPID keys are absent.
- Configure VAPID keys before expecting live push smoke tests to pass.
- Keep `VAPID_PRIVATE_KEY` server-only. Do not expose it with a `NEXT_PUBLIC_` prefix.

## Runtime Configuration

- Confirm `RATE_LIMIT_ENABLED=true`.
- Configure Upstash rate limit storage for production if available:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Confirm cron behavior:
  - `CRON_JOBS_ENABLED=true` only when the production scheduler is intended to run.
  - `CRON_SECRET` configured for protected cron routes.
- Confirm notification sending policy:
  - `NOTIFICATIONS_SEND_ENABLED` set according to the release plan.

## Smoke Tests

Run in staging before production:

- Targeted resident can mark a notice as read.
- Non-targeted resident is denied when marking a notice as read.
- Targeted resident can acknowledge an acknowledgement-required notice.
- Non-targeted resident is denied when acknowledging a notice outside their audience.
- Current recipient can archive their own notification.
- User cannot archive another user's notification.
- Push subscription succeeds with HTTPS endpoint and valid browser keys.
- Push subscription rejects non-HTTPS endpoint.
- Push subscription revoke only revokes current user's subscription.
- Web Push delivery skips cleanly when VAPID keys are absent.
- Web Push delivery sends with VAPID keys configured.
- Resident current profile returns room enrichment for an active allocation.
- Resident current profile returns null room enrichment when no active allocation exists.
- Owner analytics communication metrics load for an authorized owner.
- Support operational alerts load for authorized Owner/Admin users.
- Payment reminder dry run or staged scheduled execution does not duplicate same-day reminders.

## Monitoring Checks

Watch during and after deploy:

- API error rate for:
  - `/api/notices/[id]/read`
  - `/api/notices/[id]/acknowledge`
  - `/api/notifications/[id]/archive`
  - `/api/notifications/push-subscriptions`
  - `/api/notifications/push-subscriptions/revoke`
- Rate-limit rejection count for notification state writes and push subscription writes.
- Web Push send results:
  - successful sends
  - failed sends
  - revoked 404/410 endpoints
  - skipped sends due to missing VAPID config
- Payment reminder first-run volume.
- Scheduler health and cron execution logs.
- Database migration completion and RLS policy availability.

## Post-Deploy Verification

- Confirm migrations are listed as applied in Supabase.
- Confirm new indexes exist.
- Confirm RLS is enabled and forced for new tables.
- Run a production-safe notice read and acknowledgement smoke test with known test residents.
- Run push subscribe/revoke smoke test in a browser with VAPID keys configured.
- Verify owner analytics dashboard API response includes communication metrics.
- Verify resident current profile API still returns existing fields plus additive room fields.
- Confirm DR documentation and scripts are available in the release branch.

## Release Decision Inputs

Release can proceed when:

- Lint, typecheck, full tests, security tests, and build pass.
- Migrations are applied in order or ready for ordered deploy.
- Production backup exists.
- VAPID config is either intentionally absent with push delivery disabled/skipped, or configured for live push.
- Staging smoke tests pass.
- Monitoring owners are assigned for the first production scheduler and push-delivery window.
