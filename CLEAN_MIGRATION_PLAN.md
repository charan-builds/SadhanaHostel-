# Clean Migration Master Plan

Date: 2026-06-07

Source of truth: `origin/main` production baseline.

Migration specification: `PRODUCTION_DELTA_REPORT.md`.

Mode: planning only. Do not create branches, commits, source edits, resets, cleans, or generated artifacts from this plan.

## Ground Rules

- Start from a fresh branch based on `origin/main` when implementation begins.
- Do not cherry-pick `ui-recovery` wholesale. It is one squashed commit with production fixes mixed with UI rewrites and generated pollution.
- Migrate KEEP items only.
- Keep REVIEW items out of this roadmap unless explicitly approved later.
- Never migrate Lighthouse/Chrome profiles, `artifacts/**`, stale signoff reports, public UI rewrites, resident mobile UI rewrites, translation rewrites, image rewrites, CSS rewrites, or animation rewrites.

## Phase 1: Database Migrations

Risk level: Medium

Files required:

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`
- Additive generated schema portions of `src/types/database.ts`
- `src/types/notices.ts`

Dependencies:

- Existing `public.notices` table
- Existing `public.notifications` table
- Existing `public.residents`, `public.users`, `public.organizations`, and `public.hostels` tables
- Existing RLS helper functions: `public.can_manage_organization(...)`, `public.owns_resident(...)`, and `public.belongs_to_organization(...)`
- Existing `public.set_updated_at()` trigger function

Prerequisites:

- Confirm all prior `origin/main` migrations are applied.
- Confirm `notices` and `notifications` exist in production schema.
- Confirm RLS helper functions exist before applying new RLS policies.
- Confirm migration timestamps do not conflict with any newer production migration.

Migration order:

1. Apply `20260606001000_resident_notice_reads.sql`.
2. Apply `20260606002000_smart_notification_center.sql`.
3. Apply `20260606003000_notice_acknowledgements.sql`.
4. Apply `20260606004000_pwa_push_subscriptions.sql`.
5. Regenerate or port the additive `src/types/database.ts` table/column types.
6. Add `src/types/notices.ts` for notice engagement response typing.

Notes:

- Keep the timestamp order exactly as listed.
- Do not migrate stale evidence reports as part of this phase.
- Run security static tests after the phase is implemented.

## Phase 2: Repository Layer

Risk level: Medium

Files required:

- `src/repositories/notice-reads.repository.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/repositories/notifications.repository.ts`
- `src/repositories/residents.repository.ts`
- `src/repositories/index.ts`

Dependencies:

- Phase 1 schema and generated DB types.
- Notice read and acknowledgement tables.
- Notification category, priority, and archive columns.
- Push subscription table.
- Existing rooms and room allocations tables for resident profile enrichment.

Prerequisites:

- `src/types/database.ts` must include `notice_reads`, `notice_acknowledgements`, `push_subscriptions`, and new notification/notice columns.
- Repository updates should be additive and must preserve existing production methods.
- Supabase query pagination should stay at the end of query chains.

Migration order:

1. Add `NoticeReadsRepository`.
2. Add `NoticeAcknowledgementsRepository`.
3. Add `PushSubscriptionsRepository`.
4. Extend `NoticesRepository` with acknowledgement-required listing.
5. Extend `NotificationsRepository` in this order:
   - category, priority, archive filters
   - `markNoticeRead`
   - `archive`
   - notice recipient/read stats
   - duplicate reminder lookup
   - communication analytics
6. Extend `ResidentsRepository` with current room assignment lookup.
7. Update `src/repositories/index.ts` exports.

Notes:

- `NotificationsRepository` supports multiple later phases. Keep its changes cohesive but review every new query for tenant scoping.
- Push subscription repository writes use service/admin context later, so authorization must remain in service methods.

## Phase 3: Service Layer

Risk level: Medium

Files required:

- `src/services/notices.service.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/notifications/types.ts`
- `src/services/support.service.ts`
- `src/services/residents.service.ts`
- `src/validations/notice.validation.ts`
- `src/validations/notification.validation.ts`
- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`
- `src/lib/notifications/catalog.ts`
- `src/types/residents.ts`

Dependencies:

- Phase 1 migrations.
- Phase 2 repositories.
- Existing `AuthService`, `RealtimeService`, notification providers, and resident identity mapping.
- Existing `ADMIN_PORTAL_ROLES` for operational alerts authorization.

Prerequisites:

- Repository methods from Phase 2 must compile before service methods are migrated.
- Notice validation must normalize selected-resident audience filters before notice fanout uses them.
- Smart notification catalog must exist before notification queueing stamps category and priority.

Migration order:

1. Add notice audience targeting helpers in `src/lib/notices/audience.ts`.
2. Add notice-to-notification classification in `src/lib/notices/notification-classification.ts`.
3. Add notification category/priority catalog in `src/lib/notifications/catalog.ts`.
4. Extend `src/validations/notice.validation.ts`.
5. Extend `src/validations/notification.validation.ts`.
6. Migrate `src/services/notifications/types.ts`.
7. Extend `NotificationService` for category/priority stamping, archive support, admin-scoped reads/writes, realtime compatibility, and push handoff hooks.
8. Extend `NoticesService` for:
   - resident notice reads
   - acknowledgement-required notices
   - selected-resident targeting
   - engagement stats
   - owner/admin notice reads
9. Migrate `SupportService` operational alerts permission fix.
10. Migrate `ResidentsService` current resident room enrichment.
11. Add `CurrentResidentProfile` in `src/types/residents.ts`.

Notes:

- Keep UI display components out of this phase.
- Service methods that use admin-scoped repositories must first perform explicit auth and tenant checks.
- The push delivery service itself is handled in Phase 7, but `NotificationService` can be prepared for the handoff here if dependency wiring stays compile-safe.

## Phase 4: API Routes

Risk level: Medium

Files required:

- `src/app/api/notices/[id]/read/route.ts`
- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/app/api/notifications/[id]/archive/route.ts`
- `src/sdk/notices.sdk.ts`
- `src/sdk/notifications.sdk.ts`
- `src/hooks/use-notices.ts`
- `src/hooks/use-notifications.ts`

Dependencies:

- Phase 3 service and validation methods.
- Existing `withApiRoute`, `parseJsonBody`, and API response helpers.
- Existing SDK/api-client conventions.
- Existing React Query query keys.

Prerequisites:

- Notice and notification services must compile first.
- API route handlers must remain thin and delegate authorization to services.
- Client SDK and hooks should not require UI rewrites.

Migration order:

1. Add `POST /api/notices/[id]/read`.
2. Add `POST /api/notices/[id]/acknowledge`.
3. Add `POST /api/notifications/[id]/archive`.
4. Extend `noticesSdk` with `markRead` and `acknowledge`.
5. Extend `notificationsSdk` with `archive`.
6. Add notice hooks for mark-read and acknowledgement invalidation.
7. Add notification archive hook and keep existing notification hooks compatible.

Notes:

- Push subscription API routes are intentionally deferred to Phase 7.
- Do not migrate notification bell UI or resident notice center UI in this phase.

## Phase 5: Background Jobs

Risk level: Medium

Files required:

- `src/jobs/payment-reminder.job.ts`
- `src/jobs/scheduled-notices.job.ts`
- `src/jobs/scheduler/cron-registry.ts`
- Job-related methods from `src/repositories/notifications.repository.ts`
- `src/lib/notifications/catalog.ts`
- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`

Dependencies:

- Phase 2 notification repository duplicate lookup.
- Phase 3 notification catalog and notice targeting helpers.
- Existing payment, invoice, resident, and notification services.
- Existing scheduler registry.

Prerequisites:

- Notification category/priority schema must exist.
- `NotificationService.queue` must stamp category and priority.
- The reminder duplicate lookup must be migrated before the payment reminder job runs in staging.

Migration order:

1. Ensure notification catalog and notice targeting helpers are present.
2. Extend `NotificationsRepository` duplicate lookup for fee reminder dedupe.
3. Migrate `payment-reminder.job.ts` smart due-window logic:
   - seven-day lookahead
   - due in 7 days
   - due in 3 days
   - due tomorrow
   - due today
   - overdue
   - weekly collection reminder
   - dedupe by resident, fee record, template, and run date
4. Migrate `cron-registry.ts` payment reminder payload changes.
5. Migrate `scheduled-notices.job.ts` notice targeting/classification support if this delta is included with the notice fanout backend.

Notes:

- Run the payment reminder job in dry-run/staging before production scheduling.
- Reminder timing changes can affect resident communication volume.

## Phase 6: PWA Core

Risk level: Medium

Files required:

- `public/sw.js`
- `src/app/manifest.ts`
- `src/app/pwa-icon/[size]/route.tsx`
- `src/lib/pwa/client.ts`
- `src/components/pwa/pwa-install-prompt.tsx`
- `src/components/pwa/pwa-lifecycle.tsx`
- `/sw.js` header block from `next.config.ts`

Dependencies:

- Existing `/icon` and `/apple-icon` routes.
- Existing brand icon resolver used by `src/app/pwa-icon/[size]/route.tsx`.
- Existing resident routes and APIs cached by the service worker.
- Phase 7 push backend for full push behavior, though offline/install behavior can be migrated first.

Prerequisites:

- Review Next 16 route-handler conventions before implementing `pwa-icon` route changes.
- Confirm `next.config.ts` only receives `/sw.js` headers from `ui-recovery`; do not migrate image optimizer changes unless separately approved.
- Confirm service worker cache paths match production routes.

Migration order:

1. Add `public/sw.js`.
2. Add `src/lib/pwa/client.ts`.
3. Update `src/app/manifest.ts`.
4. Add `src/app/pwa-icon/[size]/route.tsx`.
5. Add `src/components/pwa/pwa-install-prompt.tsx`.
6. Add `src/components/pwa/pwa-lifecycle.tsx`.
7. Add only the `/sw.js` response header block in `next.config.ts`.
8. Defer provider/layout mounting decisions to a separate REVIEW task.

Notes:

- Do not migrate root provider removal or public layout changes from `ui-recovery`.
- Do not migrate resident mobile navigation or UI rewrites.
- Manual checks should cover installability, service worker registration, offline fallback, and tenant cache clearing.

## Phase 7: Push Notifications

Risk level: Medium to High

Files required:

- `src/app/api/notifications/push-subscriptions/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/pwa/web-push.service.ts`
- `src/validations/pwa.validation.ts`
- Push additions in `src/sdk/notifications.sdk.ts`
- `src/hooks/use-web-push.ts`
- Push revoke addition in `src/services/auth.service.ts`
- Web Push handoff in `src/services/notifications/notification.service.ts`
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`

Dependencies:

- Phase 1 push subscription migration.
- Phase 2 push repository.
- Phase 3 notification service updates.
- Phase 6 service worker push and notification-click handling.
- `web-push` and `@types/web-push`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and optional VAPID subject/contact env vars.

Prerequisites:

- VAPID keys must exist in staging before push smoke testing.
- Push subscriptions must be tenant-scoped and RLS protected.
- Logout cache clearing should be reviewed together with push subscription revocation.
- Browser push endpoints must be treated as delivery credentials.

Migration order:

1. Add package dependency and lockfile updates for `web-push` and `@types/web-push`.
2. Add `src/validations/pwa.validation.ts`.
3. Ensure `PushSubscriptionsRepository` exists from Phase 2.
4. Add `PushSubscriptionsService`.
5. Add `WebPushService`.
6. Add push subscription API routes.
7. Extend `notificationsSdk` with subscribe/revoke methods.
8. Add `use-web-push.ts` only when a reviewed UI surface will call it.
9. Add logout push revocation in `AuthService`.
10. Connect `NotificationService.queue` to `WebPushService.sendForNotification`.
11. Smoke test push in staging with VAPID keys.

Notes:

- Push delivery adds external network behavior to notification queueing.
- If Web Push failure should not block in-app notification creation, verify errors are handled safely before production.

## Phase 8: Analytics Backend

Risk level: Medium

Files required:

- `src/services/analytics.service.ts`
- Analytics methods in `src/repositories/notifications.repository.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/sdk/analytics.sdk.ts`

Dependencies:

- Phase 1 notice read, acknowledgement, and notification center schema.
- Phase 2 repository methods for notice recipient stats and communication analytics.
- Existing owner analytics API and SDK shape.
- Existing finance fee-record analytics.

Prerequisites:

- Notice and acknowledgement repositories must be migrated.
- Notification communication analytics method must be present.
- Owner dashboard display component is REVIEW and should not be migrated by default.

Migration order:

1. Ensure repository communication analytics methods exist.
2. Ensure acknowledgement-required notice listing exists.
3. Extend `AnalyticsService` owner analytics payload with:
   - unread notifications
   - unread notices
   - unread residents
   - overdue residents
   - notice read rates
   - notice acknowledgement rates
   - fee reminder engagement
4. Extend `src/sdk/analytics.sdk.ts` owner analytics types.
5. Keep `src/components/admin/analytics/owner-dashboard-client.tsx` out of scope until UI review.

Notes:

- Backend API can expose new metrics before the dashboard display is migrated.
- Query volume should be checked on staging because analytics reads can scan notification rows.

## Phase 9: DR Tooling

Risk level: Medium

Files required:

- `.gitignore` addition for `.manual-dr-backups/`
- `docs/operations/manual-disaster-recovery-google-drive.md`
- `scripts/recovery/manual-dr-common.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/restore-storage.sh`
- DR script entries in `package.json`
- Corresponding lockfile updates only if package metadata changes require them

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
- Existing finance reconciliation function used by validation

Prerequisites:

- Confirm backup/restore scripts do not contain source-production destructive behavior.
- Confirm restore scripts refuse production target URLs.
- Confirm Google Drive remote requirements are documented but not hard-coded as secrets.
- Confirm `.manual-dr-backups/` stays ignored.

Migration order:

1. Add `.gitignore` entry for `.manual-dr-backups/`.
2. Add shared DR helpers in `manual-dr-common.ts`.
3. Add manual backup script.
4. Add DB restore script.
5. Add storage restore script.
6. Add manual validation script.
7. Add Google Drive DR runbook.
8. Add package scripts:
   - `recovery:manual-backup`
   - `recovery:manual-restore-db`
   - `recovery:manual-restore-storage`
   - `recovery:manual-validate`
9. Do not migrate `MANUAL_DR_SIGNOFF.md` or `FINAL_PRODUCTION_READINESS_REPORT.md`.

Notes:

- Live DR commands should run only with an isolated restore target.
- Evidence reports should be regenerated after implementation, not migrated from `ui-recovery`.

## Phase 10: Tests

Risk level: Low for backend/security tests, Medium for UI-linked tests

Files required:

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

Dependencies:

- All previous phases.
- Existing fixtures and test helpers.
- Added package dependency for Web Push tests.

Prerequisites:

- Test fixtures must match `origin/main` naming and IDs.
- UI rewrite tests remain out of scope unless the UI sprint is intentionally migrated.
- Security tests should be introduced with the migrations they protect, then run again after all phases.

Migration order:

1. Add migration and tenant isolation security tests with Phase 1.
2. Add notice service and classification tests with Phases 2 and 3.
3. Add notification catalog and service tests with Phase 3.
4. Add API/SDK/hook-adjacent tests only where they do not enforce excluded UI rewrites.
5. Add payment reminder job tests with Phase 5.
6. Add PWA static tests with Phase 6.
7. Add push subscription and Web Push tests with Phase 7.
8. Add analytics service tests with Phase 8.
9. Add DR script tests with Phase 9.
10. Add operational alerts service test with Phase 3 when `SupportService` is migrated.
11. Finish with the full gate:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:security
npm run build
```

Tests to keep out of this clean migration unless separately approved:

- `src/tests/unit/components/resident-dashboard-fee-status.test.ts`
- `src/tests/unit/components/resident-finance-mobile-ux.test.ts`
- `src/tests/unit/components/resident-mobile-experience-v2.test.ts`
- `src/tests/unit/components/admin-settings-branding.test.ts`, unless optional branding backend is approved

## Cross-Phase Dependency Order

Recommended implementation sequence:

1. Phase 1: Database migrations and types
2. Phase 2: Repository layer
3. Phase 3: Service layer
4. Phase 4: API routes and SDK/hook contracts
5. Phase 5: Background jobs
6. Phase 6: PWA core
7. Phase 7: Push notifications
8. Phase 8: Analytics backend
9. Phase 9: DR tooling
10. Phase 10: Tests, both incremental and full-suite

Critical dependency chain:

- Notice and notification migrations must precede repositories.
- Repositories must precede services.
- Services and validations must precede API routes.
- Notification catalog and repository duplicate lookup must precede payment reminder scheduling.
- PWA service worker and manifest can land before push backend, but full push behavior requires Phase 7.
- Analytics backend requires notice, acknowledgement, and notification repository methods.
- DR tooling is mostly independent and can be implemented after application code, but its tests should run before final signoff.

## Out Of Scope Until Separate Approval

- Provider/session/layout migration from `ui-recovery`
- Root analytics script replacement
- Public UI restoration or public UI rewrites
- Resident mobile UI rewrites
- Dashboard notification bell UI
- Generic UI component rewrites
- Branding upload backend, unless explicitly approved
- Generated reports and screenshots
- `artifacts/**`
- Lighthouse/Chrome browser profile files

## Final Gate

The clean migration is not production-ready until all KEEP phases are implemented from `origin/main`, excluded files are absent, and the final verification gate passes:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:security
npm run build
```

GO condition: all KEEP phases migrated, no REVIEW/DISCARD files included, and all verification commands pass.

NO-GO condition: any generated pollution is present, provider/session/layout changes are migrated without review, migrations fail security tests, or any final verification command fails.
