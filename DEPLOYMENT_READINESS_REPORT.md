# Deployment Readiness Report

Date: 2026-06-07

Branch: `backend-feature-migration`

Audited commit: `798bc2a feat: notices, smart notifications, push subscriptions, pwa core and DR tooling`

Baseline: `origin/main` at `d9b0f7b`

Mode: final deployment-readiness review. No production code, UI, layouts, providers, pages, styling, images, translations, resident UI, finance UI, navigation, architecture, or feature behavior was modified for this report.

## Summary

Final deployment recommendation: GO

Risk level: MEDIUM

Deployment blockers: none.

NO ADDITIONAL CODE CHANGES RECOMMENDED

`798bc2a` contains 71 changed files. The release diff is limited to backend migrations, repositories, services, APIs, PWA core, push infrastructure, analytics backend, resident enrichment, support permission fix, payment reminder improvements, DR tooling, package changes required by Web Push, and backend/security tests.

Important scope note:

- `HEAD` and `origin/backend-feature-migration` both point to `798bc2a`.
- The local working tree currently contains uncommitted hardening/report files that are not part of `798bc2a`.
- This report audits the pushed commit `798bc2a`. Deploy from the pushed git ref, not from an unclean local working directory.

## Deployment Blockers

None.

## Deployment Warnings

1. Local worktree divergence

   The local workspace has uncommitted changes after `798bc2a`. They are not part of the pushed release commit. This is not a blocker if deployment pulls `origin/backend-feature-migration` at `798bc2a`, but it is a packaging risk if deployment is done from the local working directory.

2. Explicit rate limits on new write routes

   In `798bc2a`, these new routes do not define explicit route-level `rateLimit` options:

   - `POST /api/notices/[id]/read`
   - `POST /api/notices/[id]/acknowledge`
   - `POST /api/notifications/[id]/archive`
   - `POST /api/notifications/push-subscriptions`
   - `POST /api/notifications/push-subscriptions/revoke`

   Existing protections are still present:

   - Same-origin mutation protection in `withApiRoute`.
   - Authenticated service execution.
   - Organization access checks.
   - Tenant/user scoping in repositories.
   - Notice audience checks before read and acknowledgement writes.
   - Push revoke scoped to current user.

   This is not a deployment blocker. Monitor write volumes after release.

3. VAPID env variables are read directly by Web Push service

   `798bc2a` reads:

   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `VAPID_CONTACT_EMAIL`

   These are not listed in `.env.example`, `.env.staging.example`, or typed runtime env validation in `798bc2a`. Missing keys do not crash the app because Web Push delivery skips safely when required keys are absent. Live push delivery requires manually configuring these variables in deployment.

4. PWA registration is not mounted by this commit

   `public/sw.js`, manifest changes, PWA icon route, and `src/lib/pwa/client.ts` are present. The service-worker registration helper is not referenced by `798bc2a`, because provider/layout/UI mounting was intentionally excluded. This is not a backend blocker, but install/offline behavior should not be expected unless registration is mounted by an approved client-side integration.

5. Room/role notice audiences fail closed in service helper

   Existing database RLS supports room and role targeted notices through `public.can_read_notice(...)`. The new service helper `noticeTargetsResident(...)` supports `all`, `hostel`, and `residents` audiences. For room/role audiences, resident read/acknowledgement checks fail closed. This is safe from a security perspective and not a production backend blocker. For this release, smoke tests should use `all`, `hostel`, and selected-resident audiences.

## Required Environment Variables

Core runtime:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID`
- `NEXT_PUBLIC_DEFAULT_HOSTEL_ID`
- `RATE_LIMIT_ENABLED`
- `CRON_JOBS_ENABLED`
- `CRON_SECRET`
- `NOTIFICATIONS_SEND_ENABLED`

Recommended production rate-limit storage:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Live Web Push delivery:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- Optional: `VAPID_SUBJECT`
- Optional: `VAPID_CONTACT_EMAIL`

Manual DR tooling:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MANUAL_DR_GOOGLE_DRIVE_REMOTE` or `GOOGLE_DRIVE_BACKUP_REMOTE`
- `GOOGLE_DRIVE_BACKUP_ACCOUNT_EMAIL`
- `RESTORE_DATABASE_URL`
- `RESTORE_SUPABASE_URL`
- `RESTORE_SUPABASE_SERVICE_ROLE_KEY`

## Migration Execution Order

Apply in timestamp order:

1. `supabase/migrations/20260606001000_resident_notice_reads.sql`
2. `supabase/migrations/20260606002000_smart_notification_center.sql`
3. `supabase/migrations/20260606003000_notice_acknowledgements.sql`
4. `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

Migration safety:

- New tables use `create table if not exists`.
- New columns use `add column if not exists`.
- New indexes use `create index if not exists`.
- RLS is enabled and forced on `notice_reads`, `notice_acknowledgements`, and `push_subscriptions`.
- Policy replacement uses `drop policy if exists` followed by recreation.
- Trigger replacement uses `drop trigger if exists` followed by recreation.
- No destructive data SQL was found: no `drop table`, no `drop column`, no `delete from`, and no `truncate`.

## Verification Results

Validation status supplied in current release context:

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run test`: PASS
- `npm run test:security`: PASS
- `npm run build`: PASS

Build compatibility:

- New API route files use the current async `params` route-handler shape.
- `withApiRoute` provides request tracing, same-origin mutation protection, optional rate limiting, metrics, and error normalization.
- New PWA icon route uses `ImageResponse` and compiled in prior validation.

## Security Review

Tenant isolation:

- Notice read and acknowledgement routes require authenticated context and organization access.
- Notice lookup is scoped by `noticeId` and `organizationId`.
- Notification archive updates are scoped by notification id, organization id, and current `recipient_user_id`.
- Push subscribe requires current auth context and organization access.
- Push revoke only revokes rows for the current authenticated `user_id`.

Authorization:

- Notice management still requires `notices.manage`.
- Notice read and acknowledgement require a linked resident profile.
- Notice read and acknowledgement now check resident audience targeting before admin-scoped writes.
- Analytics backend still requires `analytics.view`.
- Operational alerts still require Owner/Admin role and hostel access before admin-scoped aggregate reads.

Admin repository usage:

- Admin repositories are used after service authorization gates.
- Notice read/acknowledgement writes occur after organization, resident, notice, and audience checks.
- Notification archive writes include current-user recipient filtering.
- Push delivery reads subscriptions for the notification recipient and masks endpoint values in logs.

RLS:

- `notice_reads` policies allow Owner/Admin organization management or linked resident ownership.
- `notice_acknowledgements` policies allow Owner/Admin organization management or linked resident ownership.
- `push_subscriptions` policies allow Owner/Admin organization management or current-user self access.
- `push_subscriptions` insert policy enforces `auth.uid() = user_id` and organization membership.
- Existing `notifications` RLS remains in place.

No cross-tenant write path or privilege escalation blocker was found.

## Package Review

Direct dependency additions:

- `web-push`
  - Required by `src/services/pwa/web-push.service.ts` for VAPID-backed Web Push delivery.

Dev dependency additions:

- `@types/web-push`
  - Required for TypeScript coverage of `web-push`.

Lockfile notes:

- `package-lock.json` includes a resolved `@next/third-parties` entry. This is not a new direct dependency in `package.json`; `@next/third-parties` was already declared and the lockfile now contains the resolved package entry.
- Web Push transitive packages are expected for `web-push`.

No unnecessary package additions were found.

## DR Tooling And Documentation Review

Reviewed:

- `docs/operations/manual-disaster-recovery-google-drive.md`
- `scripts/recovery/manual-dr-common.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/restore-storage.sh`
- `.gitignore`

Findings:

- `.manual-dr-backups/` is ignored.
- Scripts require explicit source and restore env vars.
- Restore scripts refuse to run when restore target equals source target.
- Backup/restore scripts redact known DB and service-role secrets from child-process error text.
- Console output in DR scripts is intentional CLI JSON report output, not debug logging.
- Google Drive account string is operational routing metadata, not a secret.

No DR deployment blocker found.

## Dead Code, Accidental Files, Temporary Code

Findings:

- No excluded report/audit/checklist artifacts are tracked in `origin/main..798bc2a`.
- No forbidden UI/provider/layout/public/resident/finance/navigation files are changed in the release diff.
- No temporary files, backup files, or generated browser/Lighthouse artifacts are in the release diff.
- No `TODO` or `FIXME` comments were found in changed release files.
- `temporaryPassword` matches an existing domain feature and is not temporary code.
- DR `console.log(JSON.stringify(...))` calls are expected CLI output.
- `src/lib/pwa/client.ts` is currently unreferenced by `798bc2a`; this is an intentional PWA core helper staged without provider/layout mounting.

## Smoke-Test Plan

Run in staging against the migrated database:

1. Notice read succeeds for a targeted resident.
2. Notice read is denied for a non-targeted resident.
3. Notice acknowledgement succeeds for a targeted resident on an acknowledgement-required notice.
4. Notice acknowledgement is denied for a non-targeted resident.
5. Existing notice edit flow updates title/body/status without resetting notice type, acknowledgement requirement, audience, or pin state.
6. Notification archive succeeds for the current recipient.
7. Notification archive does not update another recipient's notification.
8. Push subscribe succeeds with a valid browser subscription and HTTPS endpoint.
9. Push revoke only revokes the current user's subscriptions.
10. Web Push delivery skips cleanly when VAPID keys are absent.
11. Web Push delivery sends when VAPID keys are configured.
12. Resident current profile returns existing fields plus additive room assignment fields.
13. Owner analytics communication metrics load for authorized owner/admin users.
14. Support operational alerts load for Owner/Admin users and still deny unauthorized roles.
15. Payment reminder dry run or staging execution does not duplicate same-day reminders.
16. Manual DR backup, restore, and validation run against an isolated restore target when credentials are available.

## Rollback Plan

Before deploy:

- Verify or take a production database backup.
- Confirm restore credentials and isolated restore target are available.
- Confirm migration files are applied in the listed order.

If application deploy fails before production traffic uses new writes:

- Roll application code back to the previous production commit.
- Restore database from the pre-deploy backup only if migration side effects must be removed.

If production traffic has already written new data:

- Prefer a forward corrective migration.
- Do not drop new tables or columns without a data-retention decision.
- Preserve `notice_reads`, `notice_acknowledgements`, and `push_subscriptions` data until product/ops signs off.

## Files Reviewed

Release diff files reviewed:

- `.gitignore`
- `docs/operations/manual-disaster-recovery-google-drive.md`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `pnpm-lock.yaml`
- `public/sw.js`
- `scripts/recovery/manual-dr-common.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/restore-storage.sh`
- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/app/api/notices/[id]/read/route.ts`
- `src/app/api/notifications/[id]/archive/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `src/app/api/notifications/push-subscriptions/route.ts`
- `src/app/manifest.ts`
- `src/app/pwa-icon/[size]/route.tsx`
- `src/jobs/payment-reminder.job.ts`
- `src/jobs/scheduled-notices.job.ts`
- `src/jobs/scheduler/cron-registry.ts`
- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`
- `src/lib/notifications/catalog.ts`
- `src/lib/pwa/client.ts`
- `src/repositories/index.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/notice-reads.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/repositories/notifications.repository.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/repositories/residents.repository.ts`
- `src/sdk/analytics.sdk.ts`
- `src/sdk/notices.sdk.ts`
- `src/sdk/notifications.sdk.ts`
- `src/sdk/residents.sdk.ts`
- `src/services/analytics.service.ts`
- `src/services/auth.service.ts`
- `src/services/notices.service.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/notifications/types.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/pwa/web-push.service.ts`
- `src/services/residents.service.ts`
- `src/services/support.service.ts`
- `src/tests/security/migration-security-static.test.ts`
- `src/tests/security/tenant-isolation-static.test.ts`
- `src/tests/unit/jobs/payment-reminder-smart.test.ts`
- `src/tests/unit/lib/notice-notification-classification.test.ts`
- `src/tests/unit/lib/notifications-catalog.test.ts`
- `src/tests/unit/scripts/manual-dr-common.test.ts`
- `src/tests/unit/scripts/recovery-dr-contracts.test.ts`
- `src/tests/unit/services/analytics.service.test.ts`
- `src/tests/unit/services/notices.service.test.ts`
- `src/tests/unit/services/notification.service.test.ts`
- `src/tests/unit/services/push-subscriptions.service.test.ts`
- `src/tests/unit/services/residents.service.test.ts`
- `src/tests/unit/services/support.service.test.ts`
- `src/tests/unit/services/web-push.service.test.ts`
- `src/types/database.ts`
- `src/types/notices.ts`
- `src/types/residents.ts`
- `src/validations/notice.validation.ts`
- `src/validations/notification.validation.ts`
- `src/validations/pwa.validation.ts`
- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

## Files Requiring Action

None in `798bc2a`.

Operational actions are environment/deployment actions only:

- Deploy from the clean pushed commit, not from the dirty local worktree.
- Configure VAPID keys before expecting live push delivery.
- Verify backup and restore target before applying migrations.
- Run staging smoke tests before production traffic.

## Final Deployment Recommendation

GO

`backend-feature-migration` at `798bc2a` is deployment-ready from a production backend safety perspective. The release risk is MEDIUM because it includes additive database migrations, Web Push delivery capability, PWA core files, reminder scheduling changes, and DR tooling. No real deployment blockers were found.
