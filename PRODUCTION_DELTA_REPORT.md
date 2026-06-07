# Production Delta Report

Date: 2026-06-07

Scope: `origin/main` production baseline compared with `ui-recovery`.

Mode: read-only audit of source deltas, except for generating this report. No source code, migrations, tests, commits, resets, or cleanup commands were modified or run as part of this audit.

## Comparison Snapshot

- Production baseline: `origin/main` at `d9b0f7b updated`
- Candidate branch: `ui-recovery` at `a952faf backup all codex changes`
- Current working branch during audit: `safety/turbopack-recovery-20260607`
- Commits in `origin/main..ui-recovery`: one squashed commit only, `a952faf`
- Total changed paths in `origin/main..ui-recovery`: 1,667
- Non-generated application/report paths after excluding browser profiles and `artifacts/`: about 150
- Generated/browser pollution in `ui-recovery`: 1,463 Lighthouse/Chrome profile paths plus 54 `artifacts/` paths

Because `ui-recovery` contains one large backup commit, it should not be cherry-picked wholesale. Production-safe recovery must be file-group based.

## Exclusions Applied

Per request, this audit ignores UI and styling regressions and does not classify public/resident UI rewrites as production backend value.

Excluded from KEEP recommendations:

- Homepage, hero, navbar, language switcher, gallery, facilities, testimonials, inquiry section
- Resident dashboard UI and resident finance UI
- Animations, Framer Motion, CSS, image rendering changes
- Generic UI component rewrites unless required by backend/PWA plumbing
- Lighthouse reports, screenshots, browser profiles, generated performance artifacts

## Executive Classification

KEEP:

- Notice read tracking, notice acknowledgements, notice engagement metrics
- Smart notification center schema, category/priority/archive support
- Push subscription storage, Web Push delivery service, PWA service worker infrastructure
- Smart payment reminder scheduling and duplicate prevention
- Operational alerts Owner/Admin permission fix
- Owner analytics backend communication metrics
- Resident current profile room-assignment enrichment
- Manual DR/recovery tooling and runbook
- Security and service tests that cover the above

REVIEW:

- Auth/session/provider/layout changes
- Root analytics script replacement
- Dashboard notification bell UI and resident/admin display surfaces
- PWA mounting strategy and service worker runtime behavior
- Branding upload backend if it is not part of the intended production delta

DISCARD:

- Tracked Lighthouse/Chrome browser profiles
- `artifacts/` screenshots, Lighthouse reports, bundle reports, and smoke evidence files
- Stale generated signoff/readiness reports unless regenerated from current production evidence
- Public UI rewrites, resident mobile UI rewrites, image/translation rewrites, CSS/animation rewrites

## Detailed Delta Matrix

### Notice System

Classification: KEEP

Category: backend improvements, notice system, RLS and authorization fixes, tests

Files:

- `src/app/api/notices/[id]/read/route.ts`
- `src/hooks/use-notices.ts`
- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`
- `src/repositories/notice-reads.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/repositories/notifications.repository.ts`
- `src/sdk/notices.sdk.ts`
- `src/services/notices.service.ts`
- `src/types/database.ts`
- `src/types/notices.ts`
- `src/validations/notice.validation.ts`

Migrations:

- `supabase/migrations/20260606001000_resident_notice_reads.sql`

APIs:

- `POST /api/notices/[id]/read`

Tests:

- `src/tests/unit/services/notices.service.test.ts`
- `src/tests/unit/lib/notice-notification-classification.test.ts`
- `src/tests/security/migration-security-static.test.ts`
- `src/tests/security/tenant-isolation-static.test.ts`

Dependencies:

- Existing notices, residents, notifications, and AuthService layers
- Existing `public.can_manage_organization(...)` and `public.owns_resident(...)` RLS helpers

Risk level: Medium

Reasoning:

- The migration adds tenant-scoped `notice_reads` with forced RLS.
- Service-level reads now support resident read state and admin recipient engagement.
- Selected-resident fanout is improved through `noticeTargetsResident`.
- Risk is medium because it adds new write paths and uses admin-scoped repositories after explicit auth checks.

### Notice Acknowledgements

Classification: KEEP

Category: backend improvements, notice acknowledgements, RLS and authorization fixes, tests

Files:

- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/hooks/use-notices.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/sdk/notices.sdk.ts`
- `src/services/notices.service.ts`
- `src/types/database.ts`
- `src/types/notices.ts`
- `src/validations/notice.validation.ts`

Migrations:

- `supabase/migrations/20260606003000_notice_acknowledgements.sql`

APIs:

- `POST /api/notices/[id]/acknowledge`

Tests:

- `src/tests/unit/services/notices.service.test.ts`
- `src/tests/security/migration-security-static.test.ts`
- `src/tests/security/tenant-isolation-static.test.ts`

Dependencies:

- Existing notices table
- New `notice_type` and `requires_acknowledgement` columns
- Existing resident identity mapping

Risk level: Medium

Reasoning:

- The migration is RLS protected and preserves existing notices by adding defaulted columns.
- Resident acknowledgement is blocked unless the current user has a linked resident profile.
- Risk is medium because acknowledgement correctness depends on accurate resident-to-user linkage and notification fanout recipient counts.

### Smart Notifications

Classification: KEEP

Category: smart notifications, backend improvements, edge-case fixes, tests

Files:

- `src/app/api/notifications/[id]/archive/route.ts`
- `src/hooks/use-notifications.ts`
- `src/lib/notifications/catalog.ts`
- `src/repositories/notifications.repository.ts`
- `src/sdk/notifications.sdk.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/notifications/types.ts`
- `src/types/database.ts`
- `src/validations/notification.validation.ts`

Migrations:

- `supabase/migrations/20260606002000_smart_notification_center.sql`

APIs:

- `POST /api/notifications/[id]/archive`

Tests:

- `src/tests/unit/lib/notifications-catalog.test.ts`
- `src/tests/unit/services/notification.service.test.ts`
- `src/tests/security/migration-security-static.test.ts`

Dependencies:

- Existing notifications table
- Existing realtime notification publisher
- New notification category and priority catalog

Risk level: Medium

Reasoning:

- Adds category, priority, archived state, indexes, filtering, archive behavior, and template classification.
- Existing notification reads now exclude archived records.
- Risk is medium because new filtering can change notification-center counts and visibility.

### Push Notifications

Classification: KEEP

Category: push notifications, PWA infrastructure, security fixes, tests

Files:

- `src/app/api/notifications/push-subscriptions/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `src/hooks/use-web-push.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/sdk/notifications.sdk.ts`
- `src/services/auth.service.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/pwa/web-push.service.ts`
- `src/types/database.ts`
- `src/validations/pwa.validation.ts`

Migrations:

- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

APIs:

- `POST /api/notifications/push-subscriptions`
- `POST /api/notifications/push-subscriptions/revoke`

Tests:

- `src/tests/unit/services/push-subscriptions.service.test.ts`
- `src/tests/unit/services/web-push.service.test.ts`
- `src/tests/security/migration-security-static.test.ts`
- `src/tests/security/tenant-isolation-static.test.ts`

Dependencies:

- `web-push`
- `@types/web-push`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- Optional `VAPID_SUBJECT` or `VAPID_CONTACT_EMAIL`

Risk level: Medium to High

Reasoning:

- Push subscription storage is tenant-scoped and RLS protected.
- Logout attempts to revoke current-user push subscriptions.
- Web Push sends immediately for in-app notifications when VAPID keys are configured.
- Risk is medium to high because push delivery adds external network behavior to notification queuing and stores browser push endpoint credentials.

### PWA Infrastructure

Classification: KEEP core infrastructure, REVIEW mounting/layout integration

Category: PWA infrastructure, edge-case fixes, tests

Files:

- `public/sw.js`
- `src/app/manifest.ts`
- `src/app/pwa-icon/[size]/route.tsx`
- `src/components/pwa/pwa-install-prompt.tsx`
- `src/components/pwa/pwa-lifecycle.tsx`
- `src/lib/pwa/client.ts`
- `next.config.ts`

Migrations:

- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

APIs:

- Push subscription APIs listed above
- Generated PWA icon route: `GET /pwa-icon/[size]`

Tests:

- `src/tests/unit/pwa/pwa-static.test.ts`

Dependencies:

- Service worker headers in `next.config.ts`
- Existing `/icon` and `/apple-icon` routes
- Push notification services

Risk level: Medium

Reasoning:

- The service worker implements static cache, tenant cache, offline fallback, push, notification actions, and cache clearing.
- Manifest becomes resident-first with shortcuts.
- Keep the core PWA files, but review app/provider/layout mounting before migrating because those files alter app-wide hydration and provider boundaries.

### Payment Reminder Scheduling

Classification: KEEP

Category: finance correctness fixes, smart notifications, edge-case fixes, tests

Files:

- `src/jobs/payment-reminder.job.ts`
- `src/jobs/scheduler/cron-registry.ts`
- `src/lib/notifications/catalog.ts`
- `src/repositories/notifications.repository.ts`

Migrations:

- `supabase/migrations/20260606002000_smart_notification_center.sql`

APIs:

- None

Tests:

- `src/tests/unit/jobs/payment-reminder-smart.test.ts`
- `src/tests/unit/lib/notifications-catalog.test.ts`

Dependencies:

- Existing job scheduler
- Existing fee-record and invoice repositories
- Notification template catalog

Risk level: Medium

Reasoning:

- Daily reminder window changes from only due-before-today to a seven-day lookahead.
- Sends only exact due windows: 7 days, 3 days, tomorrow, today, overdue, and weekly collection reminders.
- Deduplicates by template, resident, fee record, and run date.
- Risk is medium because reminder volume and timing changes affect resident communications.

### Operational Alerts Permission Fix

Classification: KEEP

Category: backend improvements, security fixes, RLS and authorization fixes, tests

Files:

- `src/services/support.service.ts`

Migrations:

- None

APIs:

- Existing operational alerts API path, indirectly through `SupportService.getOperationalAlerts`

Tests:

- `src/tests/unit/services/support.service.test.ts`

Dependencies:

- `ADMIN_PORTAL_ROLES`
- Existing Support, Operations, Residents, Payments, Payment Settings, and Admissions repositories

Risk level: Low to Medium

Reasoning:

- The service still requires admin portal role and hostel access before loading alerts.
- Aggregate reads move to admin-scoped repositories after authorization, avoiding Owner/Admin denials from request-scoped RLS aggregate reads.
- Tests cover Owner allowed, Admin allowed, and unauthorized denied.

### Owner Analytics Metrics

Classification: KEEP backend, REVIEW display component

Category: analytics, backend improvements, tests

Files:

- `src/services/analytics.service.ts`
- `src/repositories/notifications.repository.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/sdk/analytics.sdk.ts`
- `src/components/admin/analytics/owner-dashboard-client.tsx` (display layer, review before migrating)

Migrations:

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`

APIs:

- Existing owner analytics API path, indirectly through `AnalyticsService`

Tests:

- `src/tests/unit/services/analytics.service.test.ts`

Dependencies:

- Notice read and acknowledgement repositories
- Notification communication analytics
- Owner analytics SDK type contract

Risk level: Medium

Reasoning:

- Adds unread notifications, unread notices, unread residents, overdue residents, notice read rates, acknowledgement rates, and fee reminder engagement.
- Backend metrics are keepable.
- The owner dashboard UI change is outside this audit's UI scope and should be manually reviewed before migration.

### Resident Lifecycle And Profile Edge Case

Classification: KEEP

Category: resident lifecycle fixes, backend improvements, tests

Files:

- `src/repositories/residents.repository.ts`
- `src/services/residents.service.ts`
- `src/sdk/residents.sdk.ts`
- `src/types/residents.ts`

Migrations:

- None

APIs:

- Existing `/api/residents/me`, indirectly returns enriched current resident profile

Tests:

- `src/tests/unit/services/residents.service.test.ts`

Dependencies:

- Existing `room_allocations` and `rooms` tables
- Existing current resident lookup

Risk level: Low to Medium

Reasoning:

- Adds active room assignment fields to the current resident profile.
- Useful for mobile/resident context without requiring a separate request.
- Risk is low to medium because API response shape broadens but remains additive.

### Branding Upload Backend

Classification: REVIEW, likely KEEP if the admin Settings logo work is intended for production

Category: backend improvements, security fixes, tests

Files:

- `src/app/api/platform/branding/upload/route.ts`
- `src/hooks/use-platform.ts`
- `src/sdk/platform.sdk.ts`
- `src/services/platform.service.ts`
- `src/validations/platform.validation.ts`

Migrations:

- None

APIs:

- `POST /api/platform/branding/upload`

Tests:

- `src/tests/unit/components/admin-settings-branding.test.ts`

Dependencies:

- Existing upload helpers and `UploadsRepository`
- Existing `gallery-images` storage bucket
- Existing `settings.manage` permission

Risk level: Medium

Reasoning:

- Route is rate-limited and service requires `settings.manage`.
- Validates file type and size, stores public document metadata, audits upload, and cleans up failed storage writes.
- Mark REVIEW because this feature is outside the requested production-delta categories unless branding settings are intentionally part of production.

### Manual DR And Recovery Tooling

Classification: KEEP tooling, DISCARD stale generated signoff/readiness reports unless regenerated

Category: DR/recovery tooling, tests

Files:

- `.gitignore`
- `docs/operations/manual-disaster-recovery-google-drive.md`
- `scripts/recovery/manual-dr-common.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/restore-storage.sh`
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`

Migrations:

- None

APIs:

- None

Tests:

- `src/tests/unit/scripts/manual-dr-common.test.ts`
- `src/tests/unit/scripts/recovery-dr-contracts.test.ts`

Dependencies:

- `pg_dump`
- `psql`
- `rclone`
- Google Drive remote for `charanderangula007@gmail.com`
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESTORE_DATABASE_URL`
- `RESTORE_SUPABASE_URL`
- `RESTORE_SUPABASE_SERVICE_ROLE_KEY`

Risk level: Medium

Reasoning:

- Adds concrete backup, upload, restore, checksum, storage, signed URL, and finance invariant validation tooling.
- Adds `.manual-dr-backups/` to `.gitignore`.
- Generated reports `MANUAL_DR_SIGNOFF.md` and `FINAL_PRODUCTION_READINESS_REPORT.md` should not be migrated as proof unless regenerated against the clean branch and current production evidence.

### Provider, Session, Layout, And Routing Changes

Classification: REVIEW

Category: auth changes, provider changes, session changes, routing changes, PWA mounting

Files:

- `src/app/layout.tsx`
- `src/app/(admin)/layout.tsx`
- `src/app/(auth)/layout.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/(resident)/layout.tsx`
- `src/components/providers/app-client-enhancements.tsx`
- `src/components/providers/app-providers.tsx`
- `src/components/providers/session-providers.tsx`
- `src/components/analytics/google-analytics-slot.tsx`
- `src/lib/analytics/google-analytics.ts`

Migrations:

- None

APIs:

- None

Tests:

- Covered indirectly by build/typecheck and PWA static tests only

Dependencies:

- React Query provider
- Auth provider
- Realtime provider
- Sentry sync
- PWA client enhancements
- Google Analytics configuration

Risk level: High

Reasoning:

- Root `AppProviders` was removed from the root layout.
- `SessionProviders` moved from `app-providers.tsx` to a new dedicated file.
- Public layout lost its provider wrapper in `ui-recovery`.
- Google Analytics changed from framework `@next/third-parties/google` to a custom script slot.
- These changes can affect hydration, public auth actions, query boundaries, service worker registration, and analytics behavior.
- Do not migrate wholesale without a dedicated provider restoration plan.

### Tests

Classification: KEEP non-UI tests, DISCARD/REVIEW UI rewrite tests

Category: tests, security fixes, backend improvements

KEEP tests:

- `src/tests/security/migration-security-static.test.ts`
- `src/tests/security/tenant-isolation-static.test.ts`
- `src/tests/unit/jobs/payment-reminder-smart.test.ts`
- `src/tests/unit/lib/notice-notification-classification.test.ts`
- `src/tests/unit/lib/notifications-catalog.test.ts`
- `src/tests/unit/pwa/pwa-static.test.ts`
- `src/tests/unit/scripts/manual-dr-common.test.ts`
- `src/tests/unit/scripts/recovery-dr-contracts.test.ts`
- `src/tests/unit/services/analytics.service.test.ts`
- `src/tests/unit/services/notices.service.test.ts`
- `src/tests/unit/services/notification.service.test.ts`
- `src/tests/unit/services/push-subscriptions.service.test.ts`
- `src/tests/unit/services/residents.service.test.ts`
- `src/tests/unit/services/support.service.test.ts`
- `src/tests/unit/services/web-push.service.test.ts`
- `src/tests/unit/validations/admin-operational.validation.test.ts`

REVIEW tests:

- `src/tests/unit/components/admin-settings-branding.test.ts`

DISCARD unless the UI sprint is intentionally reintroduced:

- `src/tests/unit/components/resident-dashboard-fee-status.test.ts`
- `src/tests/unit/components/resident-finance-mobile-ux.test.ts`
- `src/tests/unit/components/resident-mobile-experience-v2.test.ts`

Risk level: Low for backend tests, Medium for UI tests

Reasoning:

- Backend/security tests materially protect migrations, tenant isolation, service authorization, push, notices, analytics, DR scripts, and reminder scheduling.
- UI tests lock in UI rewrites that this audit intentionally excludes.

## Dangerous Or Risky Changes To Avoid Migrating Blindly

DISCARD:

- 1,463 tracked Lighthouse/Chrome profile paths containing `lighthouse.*`, `AppData`, `Default`, `Cache`, `GPUCache`, `GPUPersistentCache`, `Service Worker`, `\\wsl.localhost`, and `undefined:`.
- 54 `artifacts/` paths containing screenshots, Lighthouse reports, bundle reports, JSON summaries, and auth-redirect evidence.
- `FINAL_PRODUCTION_READINESS_REPORT.md` and `MANUAL_DR_SIGNOFF.md` as stale generated evidence unless regenerated from a clean branch and current execution.

REVIEW:

- `next.config.ts`: keep `/sw.js` headers for PWA, but review `images.remotePatterns` because image rendering changes are excluded.
- `src/app/layout.tsx`: PWA viewport metadata may be useful, but root provider removal and analytics replacement are high-risk.
- `src/app/(public)/layout.tsx`: provider boundary removal is risky and should not be migrated from `ui-recovery` as-is.
- `src/components/providers/*`: keep the concept of `AppClientEnhancements`, but review provider hierarchy.
- `src/components/layout/dashboard-user-actions.tsx`: contains notification bell, push subscribe/unsubscribe, mark read, archive, and logout cache clearing, but it is also a large UI rewrite.
- `src/components/layout/mobile-bottom-nav.tsx` and resident mobile UI files: exclude unless a separate UX migration is planned.
- `src/components/ui/*`: generic UI component rewrites are outside this production backend delta.

## Recommended Clean Migration Plan

Create a fresh branch from production:

```bash
git fetch origin
git switch -c production-delta-clean origin/main
```

Do not cherry-pick `a952faf` wholesale. It includes backend fixes, UI regressions, generated artifacts, and browser profile pollution in one commit.

### Commit 1: Notice And Smart Notification Schema

Move from `ui-recovery`:

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- Relevant additive portions of `src/types/database.ts`
- `src/types/notices.ts`

Classification: KEEP

Risk: Medium

Validation:

- `npm run test:security`
- `npm run typecheck`

### Commit 2: Notice Read, Acknowledgement, And Engagement Backend

Move from `ui-recovery`:

- `src/app/api/notices/[id]/read/route.ts`
- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`
- `src/repositories/notice-reads.repository.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/repositories/notifications.repository.ts` notice-stat methods only
- `src/services/notices.service.ts`
- `src/sdk/notices.sdk.ts`
- `src/hooks/use-notices.ts`
- `src/validations/notice.validation.ts`
- `src/tests/unit/services/notices.service.test.ts`
- `src/tests/unit/lib/notice-notification-classification.test.ts`

Classification: KEEP

Risk: Medium

Validation:

- `npm run test -- src/tests/unit/services/notices.service.test.ts`
- `npm run test:security`
- `npm run typecheck`

### Commit 3: Smart Notification Center Backend

Move from `ui-recovery`:

- `src/app/api/notifications/[id]/archive/route.ts`
- `src/lib/notifications/catalog.ts`
- Smart-notification portions of `src/repositories/notifications.repository.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/notifications/types.ts`
- `src/sdk/notifications.sdk.ts`
- `src/hooks/use-notifications.ts`
- `src/validations/notification.validation.ts`
- `src/tests/unit/lib/notifications-catalog.test.ts`
- `src/tests/unit/services/notification.service.test.ts`

Classification: KEEP

Risk: Medium

Validation:

- `npm run test -- src/tests/unit/lib/notifications-catalog.test.ts src/tests/unit/services/notification.service.test.ts`
- `npm run typecheck`

### Commit 4: Push Subscription Backend And Web Push

Move from `ui-recovery`:

- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`
- `src/app/api/notifications/push-subscriptions/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/pwa/web-push.service.ts`
- `src/validations/pwa.validation.ts`
- Push-related additions in `src/sdk/notifications.sdk.ts`
- `src/hooks/use-web-push.ts` only if notification bell UI is also migrated
- `package.json`, `package-lock.json`, `pnpm-lock.yaml` dependency additions for `web-push` and `@types/web-push`
- `src/tests/unit/services/push-subscriptions.service.test.ts`
- `src/tests/unit/services/web-push.service.test.ts`

Classification: KEEP

Risk: Medium to High

Validation:

- `npm install`
- `npm run test -- src/tests/unit/services/push-subscriptions.service.test.ts src/tests/unit/services/web-push.service.test.ts`
- `npm run test:security`
- Manual push smoke with VAPID keys in a non-production environment

### Commit 5: PWA Core Infrastructure

Move from `ui-recovery`:

- `public/sw.js`
- `src/app/manifest.ts`
- `src/app/pwa-icon/[size]/route.tsx`
- `src/lib/pwa/client.ts`
- `src/components/pwa/pwa-install-prompt.tsx`
- `src/components/pwa/pwa-lifecycle.tsx`
- `/sw.js` header block from `next.config.ts`
- PWA tests from `src/tests/unit/pwa/pwa-static.test.ts`

Do not move blindly:

- Root layout/provider changes
- Resident mobile UI rewrites
- Public UI rewrites
- Generic UI component rewrites

Classification: KEEP core, REVIEW mounting

Risk: Medium

Validation:

- `npm run test -- src/tests/unit/pwa/pwa-static.test.ts`
- `npm run build`
- Manual service-worker install, update, cache clear, offline route checks

### Commit 6: Payment Reminder Correctness

Move from `ui-recovery`:

- `src/jobs/payment-reminder.job.ts`
- `src/jobs/scheduler/cron-registry.ts`
- Payment-reminder additions in `src/lib/notifications/catalog.ts`
- Deduplication method in `src/repositories/notifications.repository.ts`
- `src/tests/unit/jobs/payment-reminder-smart.test.ts`

Classification: KEEP

Risk: Medium

Validation:

- `npm run test -- src/tests/unit/jobs/payment-reminder-smart.test.ts`
- Run scheduler/job dry-run or staging job execution

### Commit 7: Operational Alerts Permission Fix

Move from `ui-recovery`:

- `src/services/support.service.ts`
- `src/tests/unit/services/support.service.test.ts`

Classification: KEEP

Risk: Low to Medium

Validation:

- `npm run test -- src/tests/unit/services/support.service.test.ts`
- Manual Owner/Admin operational alerts API check

### Commit 8: Owner Communication Analytics Backend

Move from `ui-recovery`:

- `src/services/analytics.service.ts`
- Analytics-specific methods in `src/repositories/notifications.repository.ts`
- `src/sdk/analytics.sdk.ts`
- `src/tests/unit/services/analytics.service.test.ts`

Do not move by default:

- `src/components/admin/analytics/owner-dashboard-client.tsx` until UI review

Classification: KEEP backend, REVIEW display

Risk: Medium

Validation:

- `npm run test -- src/tests/unit/services/analytics.service.test.ts`
- Manual owner analytics API check

### Commit 9: Resident Current Profile Room Enrichment

Move from `ui-recovery`:

- `src/repositories/residents.repository.ts`
- `src/services/residents.service.ts`
- `src/sdk/residents.sdk.ts`
- `src/types/residents.ts`
- `src/tests/unit/services/residents.service.test.ts`

Classification: KEEP

Risk: Low to Medium

Validation:

- `npm run test -- src/tests/unit/services/residents.service.test.ts`
- Manual `/api/residents/me` check for resident with and without active room allocation

### Commit 10: Manual DR Tooling

Move from `ui-recovery`:

- `.gitignore` addition for `.manual-dr-backups/`
- `docs/operations/manual-disaster-recovery-google-drive.md`
- `scripts/recovery/manual-dr-common.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/restore-storage.sh`
- DR script additions in `package.json`
- Corresponding lockfile updates if package scripts or dependencies require them
- `src/tests/unit/scripts/manual-dr-common.test.ts`
- `src/tests/unit/scripts/recovery-dr-contracts.test.ts`

Do not move by default:

- `MANUAL_DR_SIGNOFF.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`

Classification: KEEP tooling, DISCARD stale evidence

Risk: Medium

Validation:

- `npm run test -- src/tests/unit/scripts/manual-dr-common.test.ts src/tests/unit/scripts/recovery-dr-contracts.test.ts`
- Live DR commands only when credentials and isolated restore target are available

### Commit 11: Provider, Session, Analytics Mounting Review

Move only after manual review:

- `src/components/providers/app-client-enhancements.tsx`
- `src/components/providers/session-providers.tsx`
- Safe portions of `src/components/providers/app-providers.tsx`
- Safe portions of `src/app/layout.tsx`
- Safe portions of route-group layouts
- `src/components/analytics/google-analytics-slot.tsx`
- `src/lib/analytics/google-analytics.ts`

Classification: REVIEW

Risk: High

Validation:

- Public homepage prerender and hydration
- Public auth actions
- Resident/admin authenticated route hydration
- Service worker registration on public-only visits
- Analytics duplicate-tag check

### Commit 12: Optional Branding Upload Backend

Move only if admin-editable branding is part of the intended production set:

- `src/app/api/platform/branding/upload/route.ts`
- `src/services/platform.service.ts`
- `src/sdk/platform.sdk.ts`
- `src/hooks/use-platform.ts`
- `src/validations/platform.validation.ts`
- `src/tests/unit/components/admin-settings-branding.test.ts`

Classification: REVIEW, likely KEEP if desired

Risk: Medium

Validation:

- `npm run test -- src/tests/unit/components/admin-settings-branding.test.ts`
- Manual upload test with JPG, PNG, WebP, too-large file, and invalid MIME

### Never Migrate From `ui-recovery`

Discard these groups:

- All `\\wsl.localhost...lighthouse.*` and `undefined:/Users/undefined/AppData/Local/lighthouse.*` paths
- All `artifacts/**` paths
- Public UI restoration/regression files unless handled in the separate UI restoration plan
- Resident mobile UI files unless handled in a separate product sprint
- Generic UI primitive rewrites unless specifically required and reviewed
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `MANUAL_DR_SIGNOFF.md`

## Final Recommendation

Do not use `ui-recovery` as a deployment branch.

Use a fresh branch from `origin/main` and migrate only the KEEP file groups above in small commits. Treat provider/session/layout changes as a separate REVIEW gate, and discard all generated browser/Lighthouse/artifact pollution. After each migration group, run targeted tests, then finish with:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:security
npm run build
```

Production delta verdict: NO-GO for wholesale `ui-recovery`; GO for a clean, file-group migration plan.
