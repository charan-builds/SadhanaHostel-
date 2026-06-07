# UI Reversion And Stability Plan

Date: 2026-06-07

Branch: `backend-feature-migration`

Baseline: `origin/main`

Mode: read-only audit and implementation plan. No source code was modified. This report is the only generated file for this request.

## Objective

Keep approved backend, security, tenant isolation, stability, edge-case, notification, analytics, resident enrichment, support, payment reminder, push subscription, DR tooling, and backend/security test improvements while preserving production UI from `origin/main`.

## Comparison Basis

Commands used:

```bash
git status --short --branch
git diff --name-status origin/main
git diff --name-only origin/main
```

Current branch state:

- `HEAD`: `798bc2a feat: notices, smart notifications, push subscriptions, pwa core and DR tooling`
- `origin/main`: `d9b0f7b updated`
- Tracked changed paths versus `origin/main`: 76
- Pushed commit changed paths versus `origin/main`: 71
- Additional local tracked changes: 12 backend/deployment hardening edits on top of `798bc2a`
- Untracked audit/report files exist locally and should remain excluded from any release commit unless explicitly requested.

Forbidden UI path scan:

- PASS: no tracked diff paths under public UI, resident UI, admin UI components, providers, app layouts, translations, image asset directories, artifacts, Lighthouse output, or browser profiles.

## High-Level Classification

KEEP_AS_IS:

- Backend migrations
- Backend repositories, services, SDKs, validations, and types
- Notice read and acknowledgement backend
- Smart notification backend
- Push subscription backend and Web Push service
- Analytics backend
- Resident profile enrichment
- Support permission fix
- Payment reminder improvements
- DR tooling and DR operational docs
- Backend/security tests
- Local hardening edits for explicit route rate limits, HTTPS push endpoint validation, and VAPID env contract

REVERT_TO_ORIGIN_MAIN:

- None found in the current tracked diff.
- No homepage, hero, gallery, facilities, testimonials, inquiry section, navbar, translation, layout, provider, resident dashboard UI, resident finance UI, mobile navigation, styling, animation, or public-page source changes are currently present.

MANUAL_REVIEW:

- PWA core files that are product-facing or install/offline related:
  - `next.config.ts`
  - `public/sw.js`
  - `src/app/manifest.ts`
  - `src/app/pwa-icon/[size]/route.tsx`
  - `src/lib/pwa/client.ts`

Reason:

- These are not public homepage/resident dashboard UI rewrites, but they can affect browser install/offline behavior, app icons, service worker scope, and resident start URL.
- Keep them only if PWA core is explicitly part of the approved backend/stability release. If the strict interpretation is “no user-facing/PWA behavior,” stage these separately and keep only push subscription backend.

## File Matrix

### KEEP_AS_IS

| File | Reason | Risk | Dependency Impact |
|---|---|---|---|
| `.env.example` | Adds optional VAPID deployment variables for Web Push readiness. | Low | Supports `src/services/pwa/web-push.service.ts`; no runtime effect by itself. |
| `.env.staging.example` | Adds optional staging VAPID deployment variables. | Low | Supports staging push smoke tests; no runtime effect by itself. |
| `.gitignore` | Keeps manual DR backup output out of git. | Low | Required by DR tooling to avoid committing `.manual-dr-backups/`. |
| `docs/operations/manual-disaster-recovery-google-drive.md` | Operational DR runbook. | Low | Documents scripts and required env; no runtime dependency. |
| `package.json` | Adds Web Push dependency and manual DR scripts. | Medium | Required by Web Push service and DR command entrypoints. |
| `package-lock.json` | Lockfile update for package additions and existing lock repair. | Medium | Must stay in sync with `package.json`. |
| `pnpm-lock.yaml` | pnpm lockfile update for package additions. | Medium | Must stay in sync with `package.json`. |
| `scripts/recovery/manual-dr-common.ts` | Shared DR backup/restore helpers. | Medium | Used by manual backup, restore, and validation scripts. |
| `scripts/recovery/manual-dr-validation.ts` | Manual DR validation script. | Medium | Depends on restore env and backup manifest. |
| `scripts/recovery/manual-google-drive-backup.ts` | Manual Google Drive backup script. | Medium | Depends on `pg_dump`, Supabase service role, and rclone remote. |
| `scripts/recovery/manual-storage-restore.ts` | Manual storage restore script. | Medium | Depends on restore Supabase URL/service role. |
| `scripts/recovery/restore-db.sh` | Isolated database restore script. | Medium | Refuses source-target restore; used by DR runbook. |
| `scripts/recovery/restore-storage.sh` | Storage restore script wrapper. | Medium | Calls manual storage restore implementation. |
| `src/app/api/notices/[id]/acknowledge/route.ts` | Adds acknowledgement API and local rate-limit hardening. | Medium | Depends on notice service and validation. |
| `src/app/api/notices/[id]/read/route.ts` | Adds notice-read API and local rate-limit hardening. | Medium | Depends on notice service and validation. |
| `src/app/api/notifications/[id]/archive/route.ts` | Adds notification archive API and local rate-limit hardening. | Low to Medium | Depends on notification service and validation. |
| `src/app/api/notifications/push-subscriptions/revoke/route.ts` | Adds push subscription revoke API and local rate-limit hardening. | Medium | Depends on push subscription service and validation. |
| `src/app/api/notifications/push-subscriptions/route.ts` | Adds push subscription API and local rate-limit hardening. | Medium | Depends on push subscription service and validation. |
| `src/config/env.ts` | Adds optional typed VAPID env contract. | Low | Supports deployment validation; no behavior change when unset. |
| `src/jobs/payment-reminder.job.ts` | Improves reminder windows and duplicate prevention. | Medium | Depends on notification catalog and notification repository dedupe. |
| `src/jobs/scheduled-notices.job.ts` | Keeps scheduled notice behavior aligned with notice backend. | Low to Medium | Depends on notice/notification services. |
| `src/jobs/scheduler/cron-registry.ts` | Registers scheduler changes for reminder behavior. | Medium | Affects cron execution order/scheduling. |
| `src/lib/notices/audience.ts` | Shared notice audience targeting helper. | Medium | Used by notice fanout/read/ack authorization. |
| `src/lib/notices/notification-classification.ts` | Classifies notice notifications. | Low | Used by notice fanout and tests. |
| `src/lib/notifications/catalog.ts` | Smart notification category/priority catalog. | Medium | Used by notifications, reminders, analytics, and tests. |
| `src/lib/rate-limit/rate-limit.ts` | Adds explicit policies for notification and push write routes. | Low to Medium | Used by new API route hardening. |
| `src/repositories/index.ts` | Exports new repositories. | Low | Required for repository import surface. |
| `src/repositories/notice-acknowledgements.repository.ts` | Data access for acknowledgements. | Medium | Depends on acknowledgement migration. |
| `src/repositories/notice-reads.repository.ts` | Data access for notice read rows. | Medium | Depends on notice reads migration. |
| `src/repositories/notices.repository.ts` | Adds notice backend fields and engagement support. | Medium | Depends on notice type/ack schema and service. |
| `src/repositories/notifications.repository.ts` | Adds smart notification, archive, engagement, dedupe, and analytics methods. | Medium | Shared by notices, reminders, analytics, push. |
| `src/repositories/push-subscriptions.repository.ts` | Push subscription storage access. | Medium | Depends on push subscription migration and Web Push service. |
| `src/repositories/residents.repository.ts` | Adds resident current profile enrichment support. | Low to Medium | Used by resident service/SDK. |
| `src/sdk/analytics.sdk.ts` | Adds analytics backend contract updates. | Low | Depends on analytics service response shape. |
| `src/sdk/notices.sdk.ts` | Adds notice read/ack SDK methods and types. | Medium | Used by non-UI consumers and future UI hooks. |
| `src/sdk/notifications.sdk.ts` | Adds notification archive/push SDK backend methods. | Medium | Used by hooks/future clients. |
| `src/sdk/residents.sdk.ts` | Adds resident profile enrichment contract. | Low | Depends on resident service/type changes. |
| `src/services/analytics.service.ts` | Adds backend communication analytics. | Medium | Depends on notice/notification repositories and migrations. |
| `src/services/auth.service.ts` | Adds push subscription revoke on logout. | Low to Medium | Depends on push subscriptions repository. |
| `src/services/notices.service.ts` | Implements notice reads, acknowledgements, engagement, audience checks, and update compatibility. | Medium | Depends on new repositories, validations, migrations, and notification service. |
| `src/services/notifications/notification.service.ts` | Adds archive behavior, smart notification metadata, and Web Push delivery integration. | Medium | Depends on notifications repo, Web Push service, catalog. |
| `src/services/notifications/types.ts` | Extends notification service type contracts. | Low | Supports notification service changes. |
| `src/services/pwa/push-subscriptions.service.ts` | Implements push subscribe/revoke authorization and storage. | Medium | Depends on auth, resident repo, push repo, validation. |
| `src/services/pwa/web-push.service.ts` | Implements VAPID Web Push delivery, failures, and endpoint cleanup. | Medium to High | Depends on `web-push`, push repo, notifications repo, VAPID env. |
| `src/services/residents.service.ts` | Adds current resident room enrichment. | Low to Medium | Depends on resident repository/type/SDK. |
| `src/services/support.service.ts` | Fixes operational alert Owner/Admin aggregate access via authorized admin repositories. | Low to Medium | Depends on existing auth role/hostel checks. |
| `src/tests/security/migration-security-static.test.ts` | Security coverage for migrations. | Low | Protects RLS/migration assumptions. |
| `src/tests/security/tenant-isolation-static.test.ts` | Tenant isolation static coverage. | Low | Protects auth/tenant assumptions. |
| `src/tests/unit/jobs/payment-reminder-smart.test.ts` | Payment reminder scheduling/dedupe coverage. | Low | Protects reminder changes. |
| `src/tests/unit/lib/env-and-versioning.test.ts` | Env coverage for optional VAPID public key. | Low | Protects deployment config parsing. |
| `src/tests/unit/lib/notice-notification-classification.test.ts` | Notice notification classification coverage. | Low | Protects catalog/classification helper. |
| `src/tests/unit/lib/notifications-catalog.test.ts` | Notification catalog coverage. | Low | Protects category/priority behavior. |
| `src/tests/unit/scripts/manual-dr-common.test.ts` | DR helper coverage. | Low | Protects backup manifest/path helpers. |
| `src/tests/unit/scripts/recovery-dr-contracts.test.ts` | DR contract coverage. | Low | Protects recovery entrypoints. |
| `src/tests/unit/services/analytics.service.test.ts` | Analytics backend coverage. | Low | Protects communication metrics. |
| `src/tests/unit/services/notices.service.test.ts` | Notice backend/read/ack/audience/update coverage. | Low | Protects most notice backend risk. |
| `src/tests/unit/services/notification.service.test.ts` | Notification backend coverage. | Low | Protects archive/list behavior. |
| `src/tests/unit/services/push-subscriptions.service.test.ts` | Push subscription auth and HTTPS validation coverage. | Low | Protects push subscribe/revoke validation. |
| `src/tests/unit/services/residents.service.test.ts` | Resident enrichment coverage. | Low | Protects additive profile fields. |
| `src/tests/unit/services/support.service.test.ts` | Support permission fix coverage. | Low | Protects Owner/Admin alert access. |
| `src/tests/unit/services/web-push.service.test.ts` | Web Push delivery/failure coverage. | Low | Protects VAPID skip and endpoint cleanup behavior. |
| `src/types/database.ts` | Generated database types for new schema. | Medium | Required by repositories/services/validations. |
| `src/types/notices.ts` | Notice DTO/engagement types. | Low | Used by notice service/SDK. |
| `src/types/residents.ts` | Additive resident profile room fields. | Low | Used by resident service/SDK. |
| `src/validations/notice.validation.ts` | Notice create/update/read/ack validation and update default fix. | Medium | Protects backward compatibility and API input. |
| `src/validations/notification.validation.ts` | Notification filters/archive validation. | Low to Medium | Used by notification APIs/services. |
| `src/validations/pwa.validation.ts` | Push subscription input validation and local HTTPS hardening. | Medium | Used by push subscription service. |
| `supabase/migrations/20260606001000_resident_notice_reads.sql` | Adds RLS-protected notice read table. | Medium | Required before notice read repository/service. |
| `supabase/migrations/20260606002000_smart_notification_center.sql` | Adds smart notification fields/indexes. | Medium | Required before notification archive/catalog filters. |
| `supabase/migrations/20260606003000_notice_acknowledgements.sql` | Adds acknowledgement schema and notice flags. | Medium | Required before acknowledgement repository/service. |
| `supabase/migrations/20260606004000_pwa_push_subscriptions.sql` | Adds RLS-protected push subscription table. | Medium to High | Required before push subscription backend. |

### MANUAL_REVIEW

| File | Reason | Risk | Dependency Impact |
|---|---|---|---|
| `next.config.ts` | Adds `/sw.js` service-worker headers. Not UI, but affects browser PWA/service worker deployment. | Medium | Needed only if PWA core is approved. If reverted, `public/sw.js` may be served with default headers and PWA behavior is not guaranteed. |
| `public/sw.js` | Adds service worker for offline cache, push events, notification clicks, and tenant cache clearing. Product-facing browser behavior. | Medium | Needed for actual browser push/offline behavior. Push backend can exist without it, but browsers will not receive push unless a service worker is registered. |
| `src/app/manifest.ts` | Changes install manifest start URL/icons/shortcuts. Product-facing PWA behavior. | Medium | Needed for resident-first PWA install experience. Revert if strict origin/main browser-install behavior is required. |
| `src/app/pwa-icon/[size]/route.tsx` | Adds generated PWA icon route using existing brand icon rendering. Touches image rendering surface, so review against “no image rendering changes.” | Medium | Needed for manifest badge/icon sizes. Revert or stage separately if image rendering must remain exactly origin/main. |
| `src/lib/pwa/client.ts` | Adds client helper for service worker registration/cache clearing. Currently unmounted in this branch. | Low to Medium | No runtime effect until imported by approved client/provider code. Keep only if PWA core will be completed later. |

### REVERT_TO_ORIGIN_MAIN

No files in the current tracked diff require direct UI rollback to `origin/main`.

If future/recovered branches introduce any of the following paths, classify them as `REVERT_TO_ORIGIN_MAIN` by default:

- `src/app/(public)/**`
- `src/components/public/**`
- `src/components/resident/**`
- `src/components/admin/**` when the change is UI-only
- `src/app/layout.tsx`
- route-group layout files
- `src/components/providers/**`
- homepage, hero, gallery, facilities, testimonials, inquiry section, navbar
- translation/message files
- image-rendering/image-asset changes not required by backend/PWA plumbing
- resident dashboard UI, resident finance UI, mobile navigation
- animation/styling/theme-only files

## Workspace-Only Files

The following untracked audit/report files are not part of the branch diff against `origin/main` and should remain untracked unless explicitly requested:

- `BLOCKER_FIX_REPORT.md`
- `CLEAN_BACKEND_MIGRATION_REPORT.md`
- `CLEAN_MIGRATION_PLAN.md`
- `DEPLOYMENT_READINESS_REPORT.md`
- `FINAL_PRE_COMMIT_CHECKLIST.md`
- `FINAL_PRODUCTION_SIGNOFF.md`
- `FINAL_RELEASE_AUDIT.md`
- `FINAL_RELEASE_SIGNOFF.md`
- `KEEP_FILES_VALIDATION_REPORT.md`
- `MERGE_PACKAGE_REPORT.md`
- `MIGRATION_EXECUTION_ORDER.md`
- `PHASE_1_DATABASE_REPORT.md`
- `PHASE_2_BACKEND_REPORT.md`
- `PHASE_3_API_REPORT.md`
- `PHASE_4_PWA_REPORT.md`
- `PRE_MERGE_PRODUCTION_AUDIT.md`
- `PRODUCTION_DELTA_REPORT.md`
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `RELEASE_PACKAGE_CLEANUP_REPORT.md`
- `UI_REVERSION_AND_STABILITY_PLAN.md`

## Exact Execution Order

### Phase A: UI Rollback

Goal: preserve `origin/main` UI exactly.

1. Start from a clean branch based on `origin/main`, or clean the current branch before implementation.
2. Run a forbidden-path scan:

   ```bash
   git diff --name-only origin/main | rg '^(src/(app/\(public\)|components/public|components/resident|components/admin|app/layout\.tsx|app/\(public\)/layout\.tsx|app/\(resident\)/layout\.tsx|components/providers)|artifacts/|.*lighthouse.*|.*AppData.*|.*Cache/|.*Default/|public/images|src/messages|src/i18n|src/translations)'
   ```

3. Revert any matched UI/provider/layout/public/resident/finance/navigation/styling/translation/image-only file to `origin/main`.
4. In the current diff, no direct UI rollback file is present.
5. Decide the MANUAL_REVIEW PWA group:
   - If PWA core is approved, keep `next.config.ts`, `public/sw.js`, `src/app/manifest.ts`, `src/app/pwa-icon/[size]/route.tsx`, and `src/lib/pwa/client.ts`.
   - If strict origin/main browser install/offline/icon behavior is required, revert that group and keep only push subscription backend.

### Phase B: Stability Fixes

Goal: apply low-risk operational/stability improvements after UI is clean.

1. Keep deployment env contract updates:
   - `.env.example`
   - `.env.staging.example`
   - `src/config/env.ts`
2. Keep route rate-limit policy additions:
   - `src/lib/rate-limit/rate-limit.ts`
   - new API route rate-limit wiring
3. Keep payment reminder scheduler improvements:
   - `src/jobs/payment-reminder.job.ts`
   - `src/jobs/scheduled-notices.job.ts`
   - `src/jobs/scheduler/cron-registry.ts`
4. Keep DR tooling and `.gitignore` changes.

### Phase C: Security Fixes

Goal: preserve tenant isolation and authorization fixes.

1. Keep database migrations with forced RLS and policies.
2. Keep notice read and acknowledgement audience checks:
   - `src/lib/notices/audience.ts`
   - `src/services/notices.service.ts`
3. Keep notification archive current-recipient scoping:
   - `src/services/notifications/notification.service.ts`
   - `src/repositories/notifications.repository.ts`
4. Keep push subscription current-user scoping and HTTPS validation:
   - `src/services/pwa/push-subscriptions.service.ts`
   - `src/repositories/push-subscriptions.repository.ts`
   - `src/validations/pwa.validation.ts`
5. Keep support operational alert permission fix:
   - `src/services/support.service.ts`

### Phase D: Backend Improvements

Goal: apply approved backend feature value without UI rewrites.

1. Apply database migrations first.
2. Apply database types and domain types.
3. Apply repositories.
4. Apply validations and shared backend libraries.
5. Apply services.
6. Apply API routes.
7. Apply SDK updates.
8. Apply backend/security tests last.
9. Keep package/lockfile changes required by Web Push and DR scripts.

### Phase E: Verification

Run the full gate:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:security
npm run build
```

Additional verification:

```bash
git diff --name-only origin/main | rg '^(src/(app/\(public\)|components/public|components/resident|components/admin|app/layout\.tsx|app/\(public\)/layout\.tsx|app/\(resident\)/layout\.tsx|components/providers)|artifacts/|.*lighthouse.*|.*AppData.*|.*Cache/|.*Default/|public/images|src/messages|src/i18n|src/translations)'
```

Expected result: no output, unless a manually approved PWA/image route exception is intentionally documented.

## Dependency Notes

- `web-push` and `@types/web-push` are required only if Web Push delivery remains in scope.
- Removing PWA core files does not remove push subscription storage/API capability, but it prevents browser-level push/offline behavior unless another service worker registration exists.
- Removing database migrations breaks dependent repositories/services/types.
- Removing notification catalog changes breaks payment reminder and analytics additions.
- Removing notice audience helper breaks fanout/read/ack authorization correctness.

## EXPECTED_END_STATE

- UI should match `origin/main`.
- Public homepage should match `origin/main`.
- Hero, gallery, facilities, testimonials, inquiry section, navbar, translations, image assets, animations, and styling should match `origin/main`.
- Providers and layouts should remain unchanged from `origin/main`.
- Resident dashboard UI should remain unchanged from `origin/main`.
- Resident finance UI should remain unchanged from `origin/main`.
- Resident navigation/mobile UI should remain unchanged from `origin/main`.
- Backend should contain all approved improvements:
  - notice reads
  - notice acknowledgements
  - smart notifications
  - analytics backend
  - resident profile enrichment
  - support permission fix
  - payment reminder improvements
  - push subscription backend
  - Web Push service if approved
  - DR tooling
  - backend/security tests
- PWA core should be either explicitly approved and retained, or separated from the backend-only release.

## Final Plan Verdict

GO for clean backend/stability recovery.

No direct UI rollback is required in the current tracked diff. The only manual decision is whether to keep or separate the PWA core/browser-install group.
