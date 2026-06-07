# Keep Files Validation Report

Date: 2026-06-07

Source documents:

- `PRODUCTION_DELTA_REPORT.md`
- `CLEAN_MIGRATION_PLAN.md`

Comparison target: KEEP/clean-migration file groups from `origin/main..ui-recovery`.

Mode: validation-only. No source code was modified.

## Executive Summary

Most backend KEEP files are valid, but not every planned file should be treated as a direct production keep.

Key findings:

- The database migrations, repositories, services, API routes, jobs, DR scripts, and backend/security tests are generally safe to keep.
- `NotificationService` has a hidden compile/runtime dependency on `WebPushService`, `PushSubscriptionsRepository`, and the `web-push` package. Do not migrate smart notification service changes without the push dependency chain or a deliberate partial edit.
- `src/types/database.ts`, lockfiles, SDKs, hooks, and barrel exports are dependency-only. They are needed for type/client integration, not standalone production behavior.
- `next.config.ts` is dependency-only and should not be copied wholesale; keep only the `/sw.js` header block unless image optimizer changes are separately approved.
- `src/components/pwa/pwa-lifecycle.tsx` is obsolete in the `ui-recovery` graph because no file imports it.
- `src/tests/unit/pwa/pwa-static.test.ts` is not safe as-is because it asserts `clearPwaTenantState` inside excluded `src/components/layout/dashboard-user-actions.tsx`.
- Branding upload, resident mobile UI tests, public UI, provider/layout, analytics script replacement, and UI notification bell files must stay out of the KEEP plan.

## SAFE_KEEP

These files are truly required for the KEEP backend/PWA/DR functionality and are safe to migrate from `ui-recovery` onto `origin/main`, subject to normal conflict review.

### Database Migrations

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
  - Required for resident notice read tracking.
  - Hidden dependencies: existing `notices`, `residents`, `organizations`, `hostels`, `users`, `public.can_manage_organization`, `public.owns_resident`, and `public.set_updated_at`.

- `supabase/migrations/20260606002000_smart_notification_center.sql`
  - Required for notification category, priority, archive state, and notification-center indexes.
  - Hidden dependencies: existing `notifications` table and existing notification status/template data.

- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
  - Required for notice type, acknowledgement-required flag, and resident acknowledgement tracking.
  - Hidden dependencies: existing `notices`, `residents`, RLS helper functions, and `public.set_updated_at`.

- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`
  - Required for tenant-scoped Web Push subscriptions.
  - Hidden dependencies: existing `organizations`, `hostels`, `users`, `residents`, `public.can_manage_organization`, and `public.belongs_to_organization`.

### Repository Layer

- `src/repositories/notice-reads.repository.ts`
  - Required by `NoticesService` for mark-read state and read counts.

- `src/repositories/notice-acknowledgements.repository.ts`
  - Required by `NoticesService` and `AnalyticsService` for acknowledgement writes and metrics.

- `src/repositories/push-subscriptions.repository.ts`
  - Required by `PushSubscriptionsService`, `WebPushService`, and `AuthService` logout revocation.

- `src/repositories/notices.repository.ts`
  - Required for acknowledgement-required notice listing and existing notice APIs.
  - Keep as an additive merge; do not drop existing production methods.

- `src/repositories/notifications.repository.ts`
  - Required for notification archive, category/priority filtering, notice recipient stats, reminder dedupe, and communication analytics.
  - Hidden dependency: `NotificationCategory` and `NotificationPriority` from `src/lib/notifications/catalog.ts`.
  - Keep as an additive merge; this file supports multiple phases.

- `src/repositories/residents.repository.ts`
  - Required for current resident room assignment enrichment.

### Service Layer

- `src/services/notices.service.ts`
  - Required for notice list engagement, resident mark-read, resident acknowledgement, selected-resident targeting, and fanout classification.
  - Hidden dependencies: notice read/ack repositories, `noticeTargetsResident`, `noticeNotificationClassification`, admin Supabase client, and notification repository stats.

- `src/services/notifications/notification.service.ts`
  - Required for notification category/priority stamping, archive, admin-scoped mark-read, realtime notification flow, and push delivery handoff.
  - Hidden dependencies: `src/services/pwa/web-push.service.ts`, `web-push`, `src/repositories/push-subscriptions.repository.ts`, and notification validation updates.
  - Migration warning: if push delivery is not migrated in the same implementation slice, this file must be partially merged to avoid compile/runtime dependency gaps.

- `src/services/support.service.ts`
  - Required for the operational alerts Owner/Admin permission fix.
  - Hidden dependencies: admin-scoped repositories and existing `ADMIN_PORTAL_ROLES`.

- `src/services/residents.service.ts`
  - Required for `/api/residents/me` current room assignment enrichment.
  - Hidden dependency: `ResidentsRepository.getCurrentRoomAssignment`.

- `src/services/analytics.service.ts`
  - Required for owner communication analytics backend metrics.
  - Hidden dependencies: notice acknowledgement repository, notices repository, notification recipient stats, and communication analytics query.

- `src/services/pwa/push-subscriptions.service.ts`
  - Required for push subscribe/revoke APIs.
  - Hidden dependencies: push repository, residents repository, AuthService context, and Supabase admin client.

- `src/services/pwa/web-push.service.ts`
  - Required for actual Web Push delivery and notification action payloads.
  - Hidden dependencies: `web-push`, VAPID env vars, `getSiteUrl`, push repository, and notifications repository logging.

- `src/services/auth.service.ts`
  - Required if push subscriptions must be revoked on logout.
  - Hidden dependencies: `PushSubscriptionsRepository` and Supabase admin client.

### Runtime Libraries And Validations

- `src/lib/notices/audience.ts`
  - Required for selected-resident notice targeting and scheduled notice filtering.

- `src/lib/notices/notification-classification.ts`
  - Required for classifying emergency, maintenance, and fee-update notices.

- `src/lib/notifications/catalog.ts`
  - Required for category/priority resolution and payment due template selection.

- `src/lib/pwa/client.ts`
  - Required for service worker registration and tenant cache clearing.
  - Hidden dependency: `public/sw.js`.

- `src/validations/notice.validation.ts`
  - Required for notice type, acknowledgement flag, mark-read payloads, and selected-resident audience filter normalization.

- `src/validations/notification.validation.ts`
  - Required for category/priority filters and archive request validation.

- `src/validations/pwa.validation.ts`
  - Required for push subscription and revoke payload validation.

### API Routes

- `src/app/api/notices/[id]/read/route.ts`
  - Required to expose resident notice mark-read.
  - Hidden dependency: `NoticesService.markNoticeRead`.

- `src/app/api/notices/[id]/acknowledge/route.ts`
  - Required to expose resident notice acknowledgement.
  - Hidden dependency: `NoticesService.acknowledgeNotice`.

- `src/app/api/notifications/[id]/archive/route.ts`
  - Required to expose notification archive.
  - Hidden dependency: `NotificationService.archive`.

- `src/app/api/notifications/push-subscriptions/route.ts`
  - Required to save browser push subscriptions.
  - Hidden dependency: `PushSubscriptionsService.subscribe`.

- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
  - Required to revoke browser push subscriptions.
  - Hidden dependency: `PushSubscriptionsService.revoke`.

### Background Jobs

- `src/jobs/payment-reminder.job.ts`
  - Required for due-window reminders and duplicate prevention.
  - Hidden dependencies: notification catalog and `NotificationsRepository.findByTemplateRecipientPayload`.

- `src/jobs/scheduled-notices.job.ts`
  - Required if notice targeting and notice classification should also apply to scheduled notices.
  - Hidden dependencies: `noticeTargetsResident` and `noticeNotificationClassification`.

- `src/jobs/scheduler/cron-registry.ts`
  - Required for seven-day payment reminder lookahead and run-date payload.

### PWA Core

- `public/sw.js`
  - Required for offline cache, push events, notification click actions, and tenant cache clearing.

- `src/app/manifest.ts`
  - Required for installable resident-first PWA metadata and shortcuts.

- `src/app/pwa-icon/[size]/route.tsx`
  - Required for maskable PWA icons.
  - Hidden dependencies confirmed present in `origin/main`: `src/components/seo/brand-icon-image.tsx` and `src/lib/public-brand-logo.ts`.

### DR Tooling

- `.gitignore`
  - Safe only for the `.manual-dr-backups/` addition.

- `docs/operations/manual-disaster-recovery-google-drive.md`
  - Required runbook for manual Google Drive DR.

- `scripts/recovery/manual-dr-common.ts`
  - Required shared helpers for manual backup, restore, checksum, and validation scripts.

- `scripts/recovery/manual-google-drive-backup.ts`
  - Required for manual DB/storage backup and Google Drive upload.

- `scripts/recovery/manual-storage-restore.ts`
  - Required for storage restore.

- `scripts/recovery/manual-dr-validation.ts`
  - Required for row count, storage count, signed URL, and finance invariant validation.

- `scripts/recovery/restore-db.sh`
  - Required for isolated DB restore.

- `scripts/recovery/restore-storage.sh`
  - Required wrapper for storage restore.

- `package.json`
  - Required for `web-push`, `@types/web-push`, and manual DR script entries.
  - Keep as a targeted merge only.

### Backend And Security Tests

- `src/tests/security/migration-security-static.test.ts`
  - Required to protect RLS and schema contracts.

- `src/tests/security/tenant-isolation-static.test.ts`
  - Required to include new tenant-scoped tables in isolation checks.

- `src/tests/unit/jobs/payment-reminder-smart.test.ts`
  - Required for reminder scheduling and dedupe contracts.

- `src/tests/unit/lib/notice-notification-classification.test.ts`
  - Required for notice classification contracts.

- `src/tests/unit/lib/notifications-catalog.test.ts`
  - Required for finance/hostel/personal notification category and priority contracts.

- `src/tests/unit/scripts/manual-dr-common.test.ts`
  - Required for manual DR helper contracts.

- `src/tests/unit/scripts/recovery-dr-contracts.test.ts`
  - Required for manual DR command/runbook contracts.

- `src/tests/unit/services/analytics.service.test.ts`
  - Required for owner communication analytics metrics.

- `src/tests/unit/services/notices.service.test.ts`
  - Required for owner/admin notice reads, resident reads, acknowledgements, and selected-recipient fanout.

- `src/tests/unit/services/notification.service.test.ts`
  - Required for notification category/priority stamping and archive ownership.

- `src/tests/unit/services/push-subscriptions.service.test.ts`
  - Required for tenant-scoped push subscription writes.

- `src/tests/unit/services/residents.service.test.ts`
  - Required for current resident profile enrichment.

- `src/tests/unit/services/support.service.test.ts`
  - Required for Owner/Admin operational alerts permission fix.

- `src/tests/unit/services/web-push.service.test.ts`
  - Required for Web Push no-config skip behavior.

- `src/tests/unit/validations/admin-operational.validation.test.ts`
  - Safe to keep if it still validates existing operational input contracts after support-service changes.

## OPTIONAL_KEEP

These files are useful but not required for the backend KEEP migration to function. Keep only if the corresponding reviewed UI/client surface is intentionally migrated.

- `src/components/pwa/pwa-install-prompt.tsx`
  - Optional because it is only mounted through `AppClientEnhancements`, which is a REVIEW/provider-layout item.
  - Keep if PWA install prompt mounting is approved.

- `src/hooks/use-web-push.ts`
  - Optional because it is currently consumed by excluded `src/components/layout/dashboard-user-actions.tsx`.
  - Keep if a reviewed notification bell or push settings UI is migrated.

- `src/hooks/use-notices.ts`
  - Optional/client-facing for mark-read and acknowledgement mutations.
  - Keep if resident notice center or dashboard popup UI is migrated.
  - Backend APIs do not require this hook.

- `src/hooks/use-notifications.ts`
  - Optional/client-facing for archive mutation.
  - Keep if notification center UI is migrated.
  - Backend APIs do not require this hook.

- `src/sdk/notices.sdk.ts`
  - Optional for client usage of mark-read and acknowledgement APIs.
  - Not required by server-side notice behavior.

- `src/sdk/notifications.sdk.ts`
  - Optional for client usage of archive and push subscription APIs.
  - Required only if client UI calls those endpoints.

- `src/sdk/analytics.sdk.ts`
  - Optional for client typing of new analytics metrics.
  - Keep if owner dashboard display is later migrated.

- `src/sdk/residents.sdk.ts`
  - Optional for client typing of enriched `/api/residents/me`.
  - Existing client code can continue to receive additive fields without this unless TypeScript consumers need the new fields.

## DEPENDENCY_ONLY

These files or file portions are not standalone feature code. They are required only to satisfy compile-time, dependency, barrel-export, or configuration needs.

- `src/types/database.ts`
  - Dependency-only generated Supabase type file.
  - Do not copy wholesale unless the clean branch schema exactly matches all generated deltas. Prefer regeneration after applying migrations.

- `src/types/notices.ts`
  - Type-only dependency for `NoticeWithEngagement`.

- `src/types/residents.ts`
  - Type-only dependency for `CurrentResidentProfile`.

- `src/services/notifications/types.ts`
  - Type dependency for message category and priority fields consumed by `NotificationService`.

- `src/repositories/index.ts`
  - Barrel export dependency only.
  - Not required by direct imports in the inspected service files, but safe if repo convention expects repository barrel exports.

- `src/hooks/index.ts`
  - Barrel export dependency only.
  - Required only if `use-web-push` or other new hooks are imported through `@/hooks`.

- `package-lock.json`
  - Dependency lockfile only.
  - Keep if npm-based install/CI remains in use.

- `pnpm-lock.yaml`
  - Dependency lockfile only.
  - Keep because `packageManager` is pnpm.

- `next.config.ts`
  - Configuration dependency only.
  - Keep only the `/sw.js` headers needed for service worker content type, cache policy, service-worker scope, and CSP.
  - Do not copy whole-file `ui-recovery` changes because it also includes image remote pattern changes that are outside KEEP scope.

## REMOVE_FROM_PLAN

These files should not be part of the clean KEEP migration as-is. Some are REVIEW items, some are UI-only, and some are obsolete.

- `src/components/pwa/pwa-lifecycle.tsx`
  - Obsolete in the inspected `ui-recovery` graph.
  - No file imports `PwaLifecycle`.
  - Remove from the clean migration unless a new reviewed mount point is explicitly planned.

- `src/tests/unit/pwa/pwa-static.test.ts`
  - Remove as-is.
  - The test asserts `clearPwaTenantState` inside `src/components/layout/dashboard-user-actions.tsx`, which is an excluded UI rewrite.
  - Recommended action: replace with a backend/PWA-focused version that checks `public/sw.js`, `src/lib/pwa/client.ts`, `src/services/auth.service.ts`, and `src/services/pwa/web-push.service.ts` without depending on excluded UI.

- `src/app/api/platform/branding/upload/route.ts`
  - REVIEW/optional branding backend, not KEEP.

- `src/services/platform.service.ts`
  - Remove from KEEP plan unless optional branding upload is explicitly approved.

- `src/sdk/platform.sdk.ts`
  - Remove from KEEP plan unless optional branding upload UI/client contract is approved.

- `src/hooks/use-platform.ts`
  - Remove from KEEP plan unless optional branding upload UI/client contract is approved.

- `src/validations/platform.validation.ts`
  - Remove from KEEP plan unless optional branding upload is approved.

- `src/tests/unit/components/admin-settings-branding.test.ts`
  - REVIEW/optional branding test, not KEEP.

- `src/tests/unit/components/resident-dashboard-fee-status.test.ts`
  - UI rewrite test. Remove from clean KEEP migration.

- `src/tests/unit/components/resident-finance-mobile-ux.test.ts`
  - UI rewrite test. Remove from clean KEEP migration.

- `src/tests/unit/components/resident-mobile-experience-v2.test.ts`
  - UI rewrite test. Remove from clean KEEP migration.

- `src/lib/finance/resident-due-status.ts`
  - Resident UI helper, not part of backend payment reminder scheduling.
  - Remove unless a separate resident UI sprint is approved.

- `src/lib/realtime/useRealtimeNotifications.ts`
  - UI/realtime hook change for notification center behavior.
  - Remove unless notification bell/center UI is approved.

- `src/components/admin/analytics/owner-dashboard-client.tsx`
  - Owner dashboard display layer. REVIEW only.

- `src/components/layout/dashboard-user-actions.tsx`
  - Notification bell, push toggle, and logout cache-clear UI rewrite. REVIEW only.

- `src/components/layout/mobile-bottom-nav.tsx`
  - Resident mobile UI rewrite. Remove from KEEP migration.

- `src/components/analytics/google-analytics-slot.tsx`
  - Root analytics mounting replacement. REVIEW only.

- `src/lib/analytics/google-analytics.ts`
  - Analytics event helper rewrite tied to root analytics mounting. REVIEW only.

- `src/components/providers/app-client-enhancements.tsx`
  - Provider/client enhancement mounting. REVIEW only.

- `src/components/providers/session-providers.tsx`
  - Provider/session hierarchy. REVIEW only.

- `src/components/providers/app-providers.tsx`
  - Provider hierarchy. REVIEW only.

- `src/app/layout.tsx`
  - Root layout/provider/analytics/PWA metadata changes. REVIEW only.

- `src/app/(admin)/layout.tsx`
  - Session provider routing change. REVIEW only.

- `src/app/(auth)/layout.tsx`
  - Session provider and route transition change. REVIEW only.

- `src/app/(public)/layout.tsx`
  - Public provider removal in `ui-recovery`. REVIEW only and should not be migrated as-is.

- `src/app/(resident)/layout.tsx`
  - Session provider routing change. REVIEW only.

## Hidden Dependencies Detected

1. `src/services/notifications/notification.service.ts` imports `src/services/pwa/web-push.service.ts`.
   - Required hidden chain: `web-push`, `src/repositories/push-subscriptions.repository.ts`, `src/types/database.ts` push subscription types, and VAPID env handling.
   - Impact: notification service smart-center changes and push integration cannot be separated without a partial merge.

2. `src/services/auth.service.ts` imports `PushSubscriptionsRepository`.
   - Required hidden chain: push subscriptions migration and repository.
   - Impact: logout revocation must wait until Phase 7 or be partially omitted.

3. `src/tests/unit/pwa/pwa-static.test.ts` imports no UI directly but reads `src/components/layout/dashboard-user-actions.tsx` from disk.
   - Impact: this test will force an excluded UI migration unless rewritten.

4. `src/components/pwa/pwa-install-prompt.tsx` is only mounted through `AppClientEnhancements`.
   - Required hidden chain if kept: provider/layout review and client enhancement mounting.

5. `src/hooks/use-web-push.ts` is only consumed by excluded `DashboardUserActions`.
   - Impact: hook is optional unless notification bell/push settings UI is approved.

6. `src/hooks/index.ts` must be updated if new hooks are retained and consumed through the `@/hooks` barrel.
   - Impact: dependency-only barrel file, not standalone functionality.

7. `next.config.ts` has both useful service worker headers and out-of-scope image remote pattern changes.
   - Impact: migrate `/sw.js` headers only.

8. `src/types/database.ts` should be regenerated from applied migrations rather than copied wholesale.
   - Impact: prevents accidental carry-over of unrelated branch schema drift.

9. `src/app/pwa-icon/[size]/route.tsx` depends on `BrandIconImage` and `getPublishedBrandIconUrl`.
   - Impact: dependencies exist in `origin/main`; safe, but still check Next 16 route conventions during implementation.

10. DR scripts depend on host tools, not npm packages.
   - Required external tools: `pg_dump`, `psql`, and `rclone`.
   - Impact: tests can validate contracts, but live DR remains credential/tooling dependent.

## Final Recommendation

Keep the backend/runtime core, but tighten the clean migration plan:

- Keep migrations, repositories, services, API routes, jobs, PWA core runtime, push services, analytics backend, DR scripts, and backend/security tests.
- Treat SDKs, hooks, generated types, barrel exports, lockfiles, and `next.config.ts` as dependency-only or partial merges.
- Remove `src/components/pwa/pwa-lifecycle.tsx` and rewrite or defer `src/tests/unit/pwa/pwa-static.test.ts`.
- Keep branding, provider/layout, notification bell UI, resident mobile UI, root analytics mounting, public UI, and generated artifacts out of the clean KEEP migration.
