# Migration Execution Order

Date: 2026-06-07

Source of truth: `origin/main`

Migration source: `ui-recovery`

Source documents:

- `PRODUCTION_DELTA_REPORT.md`
- `CLEAN_MIGRATION_PLAN.md`
- `KEEP_FILES_VALIDATION_REPORT.md`

Mode: planning artifact only. Do not create branches, commits, resets, cleans, or source changes from this document alone.

## Ground Rules

- Start implementation from a fresh branch based on `origin/main`.
- Do not cherry-pick `a952faf` or copy `ui-recovery` wholesale.
- Migrate database before repositories.
- Migrate repositories before services.
- Migrate services before APIs.
- Migrate APIs before any UI/client surface.
- Migrate tests last.
- Treat `src/types/database.ts`, lockfiles, barrels, SDKs, hooks, and `next.config.ts` as targeted or generated merges, not wholesale copies.
- Do not migrate public UI, resident mobile UI, provider/layout changes, root analytics replacement, generated artifacts, browser profiles, screenshots, or stale signoff reports.

## Phase 1: Database And Schema Types

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 1.1 | `ui-recovery:supabase/migrations/20260606001000_resident_notice_reads.sql` | `supabase/migrations/20260606001000_resident_notice_reads.sql` | Existing `notices`, `residents`, `organizations`, `hostels`, RLS helpers | `git diff --check -- supabase/migrations/20260606001000_resident_notice_reads.sql` | Remove the added migration before it is applied; if already applied in staging, run an explicit down/repair migration after review. |
| 1.2 | `ui-recovery:supabase/migrations/20260606002000_smart_notification_center.sql` | `supabase/migrations/20260606002000_smart_notification_center.sql` | Existing `notifications` table | `git diff --check -- supabase/migrations/20260606002000_smart_notification_center.sql` | Remove the added migration before apply; if applied, create a reviewed rollback migration for added columns/indexes. |
| 1.3 | `ui-recovery:supabase/migrations/20260606003000_notice_acknowledgements.sql` | `supabase/migrations/20260606003000_notice_acknowledgements.sql` | Steps 1.1 and existing `notices`, `residents`, RLS helpers | `git diff --check -- supabase/migrations/20260606003000_notice_acknowledgements.sql` | Remove before apply; if applied, create reviewed rollback migration for acknowledgement table and notice columns. |
| 1.4 | `ui-recovery:supabase/migrations/20260606004000_pwa_push_subscriptions.sql` | `supabase/migrations/20260606004000_pwa_push_subscriptions.sql` | Existing `organizations`, `hostels`, `users`, `residents`, RLS helpers | `git diff --check -- supabase/migrations/20260606004000_pwa_push_subscriptions.sql` | Remove before apply; if applied, create reviewed rollback migration for `push_subscriptions`. |
| 1.5 | Generated from clean schema after steps 1.1-1.4 | `src/types/database.ts` | Applied migrations and Supabase type generation | `npm run typecheck` | Regenerate from the clean schema or revert only the added generated table/column blocks. |
| 1.6 | `ui-recovery:src/types/notices.ts` | `src/types/notices.ts` | Notice read/ack schema types | `git diff --check -- src/types/notices.ts` | Remove the added type file or revert added exported types. |
| 1.7 | `ui-recovery:src/types/residents.ts` | `src/types/residents.ts` | Existing resident profile types | `git diff --check -- src/types/residents.ts` | Revert only additive current-room profile types. |

### STOP_POINT After Phase 1

- Compile: `npm run typecheck` should pass because only additive schema/type work has landed.
- Tests: existing production tests should remain unaffected; new security tests are not migrated yet.
- Routes: no new routes should exist yet; all existing production routes should continue to build.

## Phase 2: Shared Runtime Dependencies

These files must land before repositories/services that import them. This phase is not a UI phase.

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 2.1 | Targeted dependency additions from `ui-recovery:package.json` | `package.json` | `web-push`, `@types/web-push`; no DR scripts yet | `npm install --package-lock-only` | Remove only `web-push` and `@types/web-push` dependency entries and regenerate locks. |
| 2.2 | Targeted lock updates from `ui-recovery:package-lock.json` | `package-lock.json` | Step 2.1 | `npm install --package-lock-only` | Regenerate lock from `origin/main` package metadata. |
| 2.3 | Targeted lock updates from `ui-recovery:pnpm-lock.yaml` | `pnpm-lock.yaml` | Step 2.1 and repo package manager | `pnpm install --lockfile-only` | Regenerate lock from `origin/main` package metadata. |
| 2.4 | `ui-recovery:src/lib/notifications/catalog.ts` | `src/lib/notifications/catalog.ts` | Phase 1 notification category/priority fields | `git diff --check -- src/lib/notifications/catalog.ts` | Remove the file and revert imports that depend on notification catalog. |
| 2.5 | `ui-recovery:src/lib/notices/audience.ts` | `src/lib/notices/audience.ts` | Existing notice audience model | `git diff --check -- src/lib/notices/audience.ts` | Remove the helper and revert service/job calls to it. |
| 2.6 | `ui-recovery:src/lib/notices/notification-classification.ts` | `src/lib/notices/notification-classification.ts` | Notice type/category semantics | `git diff --check -- src/lib/notices/notification-classification.ts` | Remove the helper and revert notification classification calls. |
| 2.7 | `ui-recovery:src/validations/notice.validation.ts` | `src/validations/notice.validation.ts` | Phase 1 notice fields and selected-resident targeting | `git diff --check -- src/validations/notice.validation.ts` | Revert additive validation schema changes. |
| 2.8 | `ui-recovery:src/validations/notification.validation.ts` | `src/validations/notification.validation.ts` | Phase 1 notification category/priority/archive fields | `git diff --check -- src/validations/notification.validation.ts` | Revert additive validation schema changes. |
| 2.9 | `ui-recovery:src/validations/pwa.validation.ts` | `src/validations/pwa.validation.ts` | Phase 1 push subscription table | `git diff --check -- src/validations/pwa.validation.ts` | Remove the file and defer push API routes. |
| 2.10 | `ui-recovery:src/services/notifications/types.ts` | `src/services/notifications/types.ts` | Notification category/priority catalog | `git diff --check -- src/services/notifications/types.ts` | Revert additive type fields used by notification service. |

### STOP_POINT After Phase 2

- Compile: `npm run typecheck` should pass after dependency installation/lock regeneration.
- Tests: existing tests should remain unaffected; new feature tests are still not migrated.
- Routes: no new routes should exist yet.

## Phase 3: Repository Layer

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 3.1 | `ui-recovery:src/repositories/notice-reads.repository.ts` | `src/repositories/notice-reads.repository.ts` | Phase 1 `notice_reads` table | `git diff --check -- src/repositories/notice-reads.repository.ts` | Remove the added repository and revert service imports. |
| 3.2 | `ui-recovery:src/repositories/notice-acknowledgements.repository.ts` | `src/repositories/notice-acknowledgements.repository.ts` | Phase 1 `notice_acknowledgements` table | `git diff --check -- src/repositories/notice-acknowledgements.repository.ts` | Remove the added repository and revert service/analytics imports. |
| 3.3 | `ui-recovery:src/repositories/push-subscriptions.repository.ts` | `src/repositories/push-subscriptions.repository.ts` | Phase 1 `push_subscriptions` table | `git diff --check -- src/repositories/push-subscriptions.repository.ts` | Remove the added repository and defer push services/API. |
| 3.4 | Additive merge from `ui-recovery:src/repositories/notices.repository.ts` | `src/repositories/notices.repository.ts` | Steps 3.1-3.2 and existing notice repository methods | `git diff --check -- src/repositories/notices.repository.ts` | Revert only notice engagement/acknowledgement hunks; preserve origin/main methods. |
| 3.5 | Additive merge from `ui-recovery:src/repositories/notifications.repository.ts` | `src/repositories/notifications.repository.ts` | Phase 1 notification fields, Step 2.4 catalog, Steps 3.1-3.2 | `git diff --check -- src/repositories/notifications.repository.ts` | Revert category/filter/archive/stats/dedupe/analytics hunks individually. |
| 3.6 | Additive merge from `ui-recovery:src/repositories/residents.repository.ts` | `src/repositories/residents.repository.ts` | Existing `room_allocations` and `rooms` tables | `git diff --check -- src/repositories/residents.repository.ts` | Revert only current-room assignment lookup hunks. |
| 3.7 | Targeted export merge from `ui-recovery:src/repositories/index.ts` | `src/repositories/index.ts` | Steps 3.1-3.3 | `git diff --check -- src/repositories/index.ts` | Remove only new repository exports. |

### STOP_POINT After Phase 3

- Compile: `npm run typecheck` should pass.
- Tests: existing tests should remain green; new repository behavior is not test-migrated yet.
- Routes: no new routes should exist yet; existing production routes should still build.

## Phase 4: Service Layer

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 4.1 | `ui-recovery:src/services/pwa/push-subscriptions.service.ts` | `src/services/pwa/push-subscriptions.service.ts` | Push repository, PWA validation, residents repository, AuthService context | `git diff --check -- src/services/pwa/push-subscriptions.service.ts` | Remove push subscription service and defer push APIs. |
| 4.2 | `ui-recovery:src/services/pwa/web-push.service.ts` | `src/services/pwa/web-push.service.ts` | `web-push`, push repository, `getSiteUrl`, VAPID env vars | `git diff --check -- src/services/pwa/web-push.service.ts` | Remove Web Push service and partially revert notification service push handoff. |
| 4.3 | Additive merge from `ui-recovery:src/services/notifications/notification.service.ts` | `src/services/notifications/notification.service.ts` | Notification repository, Step 2.4 catalog, Step 4.2 Web Push service | `git diff --check -- src/services/notifications/notification.service.ts` | Revert archive/category/priority/push hunks separately; keep origin/main queue behavior. |
| 4.4 | Additive merge from `ui-recovery:src/services/notices.service.ts` | `src/services/notices.service.ts` | Notice repositories, notification repository, audience/classification helpers | `git diff --check -- src/services/notices.service.ts` | Revert mark-read/acknowledgement/engagement/targeting hunks. |
| 4.5 | Additive merge from `ui-recovery:src/services/residents.service.ts` | `src/services/residents.service.ts` | Residents repository current-room lookup and `src/types/residents.ts` | `git diff --check -- src/services/residents.service.ts` | Revert current-room enrichment hunks. |
| 4.6 | Additive merge from `ui-recovery:src/services/support.service.ts` | `src/services/support.service.ts` | Existing `ADMIN_PORTAL_ROLES`, admin-scoped repositories | `git diff --check -- src/services/support.service.ts` | Revert operational-alerts aggregate-read authorization hunks. |
| 4.7 | Additive merge from `ui-recovery:src/services/auth.service.ts` | `src/services/auth.service.ts` | PushSubscriptionsRepository and Supabase admin client | `git diff --check -- src/services/auth.service.ts` | Revert logout push-revocation hunks only. |
| 4.8 | Additive merge from `ui-recovery:src/services/analytics.service.ts` | `src/services/analytics.service.ts` | Notice, acknowledgement, notification repositories | `git diff --check -- src/services/analytics.service.ts` | Revert communication-metric additions only. |

### STOP_POINT After Phase 4

- Compile: `npm run typecheck` should pass with all service imports resolved.
- Tests: existing service tests should pass; new service tests are still not migrated.
- Routes: existing routes should still work. New notice/notification/push endpoints should not exist until Phase 5.

## Phase 5: API Routes And Client Contracts

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 5.1 | `ui-recovery:src/app/api/notices/[id]/read/route.ts` | `src/app/api/notices/[id]/read/route.ts` | `NoticesService.markNoticeRead` | `git diff --check -- 'src/app/api/notices/[id]/read/route.ts'` | Remove route file and SDK/hook methods that call it. |
| 5.2 | `ui-recovery:src/app/api/notices/[id]/acknowledge/route.ts` | `src/app/api/notices/[id]/acknowledge/route.ts` | `NoticesService.acknowledgeNotice` | `git diff --check -- 'src/app/api/notices/[id]/acknowledge/route.ts'` | Remove route file and SDK/hook methods that call it. |
| 5.3 | `ui-recovery:src/app/api/notifications/[id]/archive/route.ts` | `src/app/api/notifications/[id]/archive/route.ts` | `NotificationService.archive` | `git diff --check -- 'src/app/api/notifications/[id]/archive/route.ts'` | Remove route file and SDK/hook methods that call it. |
| 5.4 | `ui-recovery:src/app/api/notifications/push-subscriptions/route.ts` | `src/app/api/notifications/push-subscriptions/route.ts` | `PushSubscriptionsService.subscribe` and PWA validation | `git diff --check -- src/app/api/notifications/push-subscriptions/route.ts` | Remove route file and client push subscription calls. |
| 5.5 | `ui-recovery:src/app/api/notifications/push-subscriptions/revoke/route.ts` | `src/app/api/notifications/push-subscriptions/revoke/route.ts` | `PushSubscriptionsService.revoke` and PWA validation | `git diff --check -- src/app/api/notifications/push-subscriptions/revoke/route.ts` | Remove route file and client revoke calls. |
| 5.6 | Additive merge from `ui-recovery:src/sdk/notices.sdk.ts` | `src/sdk/notices.sdk.ts` | Steps 5.1-5.2 | `git diff --check -- src/sdk/notices.sdk.ts` | Revert mark-read/acknowledge SDK methods. |
| 5.7 | Additive merge from `ui-recovery:src/sdk/notifications.sdk.ts` | `src/sdk/notifications.sdk.ts` | Steps 5.3-5.5 | `git diff --check -- src/sdk/notifications.sdk.ts` | Revert archive/subscribe/revoke SDK methods. |
| 5.8 | Additive merge from `ui-recovery:src/sdk/residents.sdk.ts` | `src/sdk/residents.sdk.ts` | Resident profile enrichment types | `git diff --check -- src/sdk/residents.sdk.ts` | Revert additive current-room response typing only. |
| 5.9 | Additive merge from `ui-recovery:src/sdk/analytics.sdk.ts` | `src/sdk/analytics.sdk.ts` | Analytics service payload additions | `git diff --check -- src/sdk/analytics.sdk.ts` | Revert owner communication metric fields only. |
| 5.10 | Optional merge from `ui-recovery:src/hooks/use-notices.ts` | `src/hooks/use-notices.ts` | Notice SDK methods; reviewed resident notice UI later | `git diff --check -- src/hooks/use-notices.ts` | Revert new mutation hooks; backend APIs remain intact. |
| 5.11 | Optional merge from `ui-recovery:src/hooks/use-notifications.ts` | `src/hooks/use-notifications.ts` | Notification SDK archive method; reviewed notification center UI later | `git diff --check -- src/hooks/use-notifications.ts` | Revert archive hook; backend API remains intact. |
| 5.12 | Optional merge from `ui-recovery:src/hooks/use-web-push.ts` | `src/hooks/use-web-push.ts` | Push SDK methods; reviewed notification bell/push settings UI later | `git diff --check -- src/hooks/use-web-push.ts` | Remove hook and keep push APIs/service if server-side push remains required. |
| 5.13 | Targeted export merge from `ui-recovery:src/hooks/index.ts` | `src/hooks/index.ts` | Steps 5.10-5.12 only if hooks are kept | `git diff --check -- src/hooks/index.ts` | Remove added hook exports. |

### STOP_POINT After Phase 5

- Compile: `npm run typecheck` and `npm run build` should pass.
- Tests: existing tests should pass; new API/client tests are still not migrated.
- Routes that should work:
  - `POST /api/notices/[id]/read`
  - `POST /api/notices/[id]/acknowledge`
  - `POST /api/notifications/[id]/archive`
  - `POST /api/notifications/push-subscriptions`
  - `POST /api/notifications/push-subscriptions/revoke`

## Phase 6: Background Jobs

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 6.1 | Additive merge from `ui-recovery:src/jobs/payment-reminder.job.ts` | `src/jobs/payment-reminder.job.ts` | Notification catalog, notification repository dedupe method, existing fee/invoice repositories | `git diff --check -- src/jobs/payment-reminder.job.ts` | Revert seven-day lookahead/dedupe template changes; restore origin/main reminder window. |
| 6.2 | Additive merge from `ui-recovery:src/jobs/scheduled-notices.job.ts` | `src/jobs/scheduled-notices.job.ts` | Notice audience/classification helpers and notice service fanout behavior | `git diff --check -- src/jobs/scheduled-notices.job.ts` | Revert targeting/classification hunks. |
| 6.3 | Additive merge from `ui-recovery:src/jobs/scheduler/cron-registry.ts` | `src/jobs/scheduler/cron-registry.ts` | Payment reminder payload/run-date changes | `git diff --check -- src/jobs/scheduler/cron-registry.ts` | Revert scheduler payload changes for payment reminders. |

### STOP_POINT After Phase 6

- Compile: `npm run typecheck` should pass.
- Tests: existing job tests should pass; new smart reminder tests are still not migrated.
- Routes: no new HTTP routes in this phase. Scheduler should still register existing jobs and payment reminder job should be dry-run safe in staging.

## Phase 7: PWA Core Runtime

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 7.1 | `ui-recovery:public/sw.js` | `public/sw.js` | Existing app routes, push APIs, tenant cache names | `git diff --check -- public/sw.js` | Remove service worker file and revert `/sw.js` headers/client registration. |
| 7.2 | `ui-recovery:src/lib/pwa/client.ts` | `src/lib/pwa/client.ts` | `public/sw.js` | `git diff --check -- src/lib/pwa/client.ts` | Remove PWA client helper and defer service worker registration. |
| 7.3 | Additive merge from `ui-recovery:src/app/manifest.ts` | `src/app/manifest.ts` | Existing app icon routes and resident routes | `git diff --check -- src/app/manifest.ts` | Revert manifest to origin/main version. |
| 7.4 | `ui-recovery:src/app/pwa-icon/[size]/route.tsx` | `src/app/pwa-icon/[size]/route.tsx` | Existing `BrandIconImage` and brand icon resolver | `git diff --check -- 'src/app/pwa-icon/[size]/route.tsx'` | Remove generated icon route and revert manifest icon references. |
| 7.5 | Targeted header merge from `ui-recovery:next.config.ts` | `next.config.ts` | `public/sw.js`; service worker MIME/scope/cache headers | `git diff --check -- next.config.ts` | Remove only `/sw.js` header block; do not alter image config. |

Deferred in this phase:

- Do not migrate `src/components/pwa/pwa-install-prompt.tsx` unless provider/layout mounting is separately approved.
- Do not migrate `src/components/pwa/pwa-lifecycle.tsx`; it is obsolete in the validated graph.
- Do not migrate provider/layout changes from `ui-recovery`.

### STOP_POINT After Phase 7

- Compile: `npm run typecheck` and `npm run build` should pass.
- Tests: existing tests should pass; PWA static test is not migrated as-is.
- Routes/assets that should work:
  - `GET /sw.js`
  - `GET /manifest.webmanifest` or the production manifest route emitted by Next
  - `GET /pwa-icon/192`

## Phase 8: DR Tooling

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 8.1 | Targeted ignore entry from `ui-recovery:.gitignore` | `.gitignore` | `.manual-dr-backups/` local output directory | `git diff --check -- .gitignore` | Remove only `.manual-dr-backups/` ignore entry. |
| 8.2 | `ui-recovery:scripts/recovery/manual-dr-common.ts` | `scripts/recovery/manual-dr-common.ts` | Node runtime, shell tools, env contracts | `git diff --check -- scripts/recovery/manual-dr-common.ts` | Remove helper and dependent DR scripts. |
| 8.3 | `ui-recovery:scripts/recovery/manual-google-drive-backup.ts` | `scripts/recovery/manual-google-drive-backup.ts` | Step 8.2, `pg_dump`, `rclone`, Supabase env vars | `git diff --check -- scripts/recovery/manual-google-drive-backup.ts` | Remove backup script and package script entry. |
| 8.4 | `ui-recovery:scripts/recovery/restore-db.sh` | `scripts/recovery/restore-db.sh` | `psql`, isolated restore target env vars | `git diff --check -- scripts/recovery/restore-db.sh` | Remove shell script and package script entry. |
| 8.5 | `ui-recovery:scripts/recovery/manual-storage-restore.ts` | `scripts/recovery/manual-storage-restore.ts` | Step 8.2, restore Supabase env vars | `git diff --check -- scripts/recovery/manual-storage-restore.ts` | Remove storage restore script and package script entry. |
| 8.6 | `ui-recovery:scripts/recovery/restore-storage.sh` | `scripts/recovery/restore-storage.sh` | Step 8.5 | `git diff --check -- scripts/recovery/restore-storage.sh` | Remove wrapper script and package script entry. |
| 8.7 | `ui-recovery:scripts/recovery/manual-dr-validation.ts` | `scripts/recovery/manual-dr-validation.ts` | Step 8.2, restored DB/storage env vars, finance invariant checks | `git diff --check -- scripts/recovery/manual-dr-validation.ts` | Remove validation script and package script entry. |
| 8.8 | `ui-recovery:docs/operations/manual-disaster-recovery-google-drive.md` | `docs/operations/manual-disaster-recovery-google-drive.md` | Steps 8.2-8.7 and Google Drive remote requirements | `git diff --check -- docs/operations/manual-disaster-recovery-google-drive.md` | Remove runbook or revert stale sections. |
| 8.9 | Targeted DR script merge from `ui-recovery:package.json` | `package.json` | Steps 8.2-8.7 | `git diff --check -- package.json` | Remove only DR package scripts. |

Do not migrate:

- `MANUAL_DR_SIGNOFF.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- generated backup outputs

### STOP_POINT After Phase 8

- Compile: `npm run typecheck` should pass.
- Tests: existing tests should pass; DR tests are still not migrated.
- Routes: no app routes are changed. DR commands should exist in package scripts only after their target scripts exist.

## Phase 9: Tests Last

| Step | Source file | Target file | Dependencies | Validation command | Rollback strategy |
|---|---|---|---|---|---|
| 9.1 | `ui-recovery:src/tests/security/migration-security-static.test.ts` | `src/tests/security/migration-security-static.test.ts` | Phase 1 migrations | `npm run test:security` | Remove/revert only new migration security assertions. |
| 9.2 | `ui-recovery:src/tests/security/tenant-isolation-static.test.ts` | `src/tests/security/tenant-isolation-static.test.ts` | Phase 1 tenant-scoped tables | `npm run test:security` | Remove/revert only new tenant isolation assertions. |
| 9.3 | `ui-recovery:src/tests/unit/lib/notice-notification-classification.test.ts` | `src/tests/unit/lib/notice-notification-classification.test.ts` | Step 2.6 | `npm run test -- src/tests/unit/lib/notice-notification-classification.test.ts` | Remove the test file. |
| 9.4 | `ui-recovery:src/tests/unit/lib/notifications-catalog.test.ts` | `src/tests/unit/lib/notifications-catalog.test.ts` | Step 2.4 and Phase 6 reminders | `npm run test -- src/tests/unit/lib/notifications-catalog.test.ts` | Remove the test file. |
| 9.5 | `ui-recovery:src/tests/unit/services/notices.service.test.ts` | `src/tests/unit/services/notices.service.test.ts` | Phases 3-5 notice backend | `npm run test -- src/tests/unit/services/notices.service.test.ts` | Remove/revert notice service test additions. |
| 9.6 | `ui-recovery:src/tests/unit/services/notification.service.test.ts` | `src/tests/unit/services/notification.service.test.ts` | Notification service archive/category/push behavior | `npm run test -- src/tests/unit/services/notification.service.test.ts` | Remove/revert notification service test additions. |
| 9.7 | `ui-recovery:src/tests/unit/services/push-subscriptions.service.test.ts` | `src/tests/unit/services/push-subscriptions.service.test.ts` | Push subscription service and repository | `npm run test -- src/tests/unit/services/push-subscriptions.service.test.ts` | Remove the test file. |
| 9.8 | `ui-recovery:src/tests/unit/services/web-push.service.test.ts` | `src/tests/unit/services/web-push.service.test.ts` | Web Push service and `web-push` dependency | `npm run test -- src/tests/unit/services/web-push.service.test.ts` | Remove the test file. |
| 9.9 | `ui-recovery:src/tests/unit/services/analytics.service.test.ts` | `src/tests/unit/services/analytics.service.test.ts` | Analytics service communication metrics | `npm run test -- src/tests/unit/services/analytics.service.test.ts` | Remove/revert analytics metric test additions. |
| 9.10 | `ui-recovery:src/tests/unit/services/residents.service.test.ts` | `src/tests/unit/services/residents.service.test.ts` | Resident current-room enrichment | `npm run test -- src/tests/unit/services/residents.service.test.ts` | Remove/revert current-room enrichment tests. |
| 9.11 | `ui-recovery:src/tests/unit/services/support.service.test.ts` | `src/tests/unit/services/support.service.test.ts` | Operational alerts permission fix | `npm run test -- src/tests/unit/services/support.service.test.ts` | Remove/revert Owner/Admin alerts tests. |
| 9.12 | `ui-recovery:src/tests/unit/jobs/payment-reminder-smart.test.ts` | `src/tests/unit/jobs/payment-reminder-smart.test.ts` | Phase 6 payment reminder changes | `npm run test -- src/tests/unit/jobs/payment-reminder-smart.test.ts` | Remove the test file. |
| 9.13 | `ui-recovery:src/tests/unit/scripts/manual-dr-common.test.ts` | `src/tests/unit/scripts/manual-dr-common.test.ts` | Phase 8 DR common helper | `npm run test -- src/tests/unit/scripts/manual-dr-common.test.ts` | Remove the test file. |
| 9.14 | `ui-recovery:src/tests/unit/scripts/recovery-dr-contracts.test.ts` | `src/tests/unit/scripts/recovery-dr-contracts.test.ts` | Phase 8 DR scripts and runbook | `npm run test -- src/tests/unit/scripts/recovery-dr-contracts.test.ts` | Remove the test file. |
| 9.15 | `ui-recovery:src/tests/unit/validations/admin-operational.validation.test.ts` | `src/tests/unit/validations/admin-operational.validation.test.ts` | Existing operational validation contracts | `npm run test -- src/tests/unit/validations/admin-operational.validation.test.ts` | Remove/revert added assertions if unrelated. |

Do not copy as-is:

- `ui-recovery:src/tests/unit/pwa/pwa-static.test.ts`; rewrite/defer because it asserts excluded `dashboard-user-actions.tsx`.
- `ui-recovery:src/tests/unit/components/resident-dashboard-fee-status.test.ts`
- `ui-recovery:src/tests/unit/components/resident-finance-mobile-ux.test.ts`
- `ui-recovery:src/tests/unit/components/resident-mobile-experience-v2.test.ts`
- `ui-recovery:src/tests/unit/components/admin-settings-branding.test.ts`, unless branding backend is approved separately.

### STOP_POINT After Phase 9

- Compile:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- Tests:
  - `npm run test`
  - `npm run test:security`
- Routes that should work:
  - All existing production routes from `origin/main`
  - `POST /api/notices/[id]/read`
  - `POST /api/notices/[id]/acknowledge`
  - `POST /api/notifications/[id]/archive`
  - `POST /api/notifications/push-subscriptions`
  - `POST /api/notifications/push-subscriptions/revoke`
  - Existing owner analytics route with additive backend metrics
  - Existing `/api/residents/me` with additive current-room fields
  - `GET /sw.js`
  - `GET /pwa-icon/[size]`

## STOP_POINTS Summary

1. After Phase 1: typecheck passes; no new routes; schema/type layer is additive.
2. After Phase 2: typecheck passes; shared helpers and package dependencies resolve.
3. After Phase 3: typecheck passes; repository imports resolve; no new routes yet.
4. After Phase 4: typecheck passes; service imports resolve; existing routes still work.
5. After Phase 5: typecheck and build pass; new notice/notification/push API routes compile.
6. After Phase 6: typecheck passes; scheduler and reminder jobs compile.
7. After Phase 7: typecheck and build pass; service worker, manifest, and PWA icon route compile.
8. After Phase 8: typecheck passes; DR package scripts point to existing scripts.
9. After Phase 9: full gate passes: lint, typecheck, test, test:security, build.

## Rollback Principles

- Added files: remove the added target file and any direct import/export that references it.
- Modified files: revert only the migrated hunks, preserving unrelated production code.
- Migrations: do not delete an already-applied production migration; create a reviewed rollback/repair migration.
- Generated types: regenerate from the current clean schema instead of hand-reverting large generated sections.
- Lockfiles: regenerate from the target branch package metadata rather than copying old locks around.
- Optional SDKs/hooks: safe to revert independently if no approved UI consumes them.

## Explicitly Deferred

- Public UI files
- Resident dashboard UI
- Resident finance UI
- Dashboard notification bell UI
- Provider/session/layout changes
- Root analytics script replacement
- Branding upload backend
- Generic UI primitive rewrites
- `artifacts/**`
- Lighthouse and Chrome browser profile paths
- `MANUAL_DR_SIGNOFF.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`

Final recommendation: implement this sequence as small file-group migrations from `ui-recovery` onto a fresh `origin/main` branch, stopping at every STOP_POINT before continuing.
