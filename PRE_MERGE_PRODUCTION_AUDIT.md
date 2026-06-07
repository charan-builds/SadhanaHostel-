# Pre-Merge Production Audit

Date: 2026-06-07

Target: `backend-feature-migration`

Baseline: `origin/main`

Mode: read-only code audit, except for generating this report. No source code was modified.

## Scope Note

`backend-feature-migration` currently points at the same commit as `origin/main`:

- `backend-feature-migration`: `d9b0f7b updated`
- `origin/main`: `d9b0f7b updated`

Therefore, `git diff origin/main..backend-feature-migration` is empty. This audit treats the current uncommitted working-tree migration set on `backend-feature-migration` as the pre-merge candidate.

Existing untracked audit reports are workspace artifacts and are not counted as migration source files.

## Summary

Changed migration files audited: 71

Forbidden-path audit: PASS

Dependency audit: REVIEW, no accidental runtime feature dependency found, but lockfile also repairs existing `@next/third-parties` lock state.

Migration audit: REVIEW, schema is additive and RLS-protected, but rollback is forward-only/manual.

API audit: NO-GO until authorization/rate-limit issues are resolved or formally accepted.

Production audit: NO-GO because of a backward-compatibility bug in notice update validation.

## Changed Files By Category

### Database

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`
- `src/types/database.ts`

### Repository

- `src/repositories/index.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/notice-reads.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/repositories/notifications.repository.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/repositories/residents.repository.ts`

### Service

- `src/services/auth.service.ts`
- `src/services/notices.service.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/notifications/types.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/pwa/web-push.service.ts`
- `src/services/residents.service.ts`
- `src/services/support.service.ts`

### API

- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/app/api/notices/[id]/read/route.ts`
- `src/app/api/notifications/[id]/archive/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `src/app/api/notifications/push-subscriptions/route.ts`

### PWA

- `next.config.ts`
- `public/sw.js`
- `src/app/manifest.ts`
- `src/app/pwa-icon/[size]/route.tsx`
- `src/lib/pwa/client.ts`

### Push

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `src/repositories/push-subscriptions.repository.ts`
- `src/services/auth.service.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/pwa/web-push.service.ts`
- `src/validations/pwa.validation.ts`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

### Analytics

- `src/sdk/analytics.sdk.ts`
- `src/services/analytics.service.ts`

### DR

- `.gitignore`
- `docs/operations/manual-disaster-recovery-google-drive.md`
- `package.json`
- `scripts/recovery/manual-dr-common.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/restore-storage.sh`

### Tests

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

### Other

- `src/jobs/payment-reminder.job.ts`
- `src/jobs/scheduled-notices.job.ts`
- `src/jobs/scheduler/cron-registry.ts`
- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`
- `src/lib/notifications/catalog.ts`
- `src/sdk/notices.sdk.ts`
- `src/sdk/notifications.sdk.ts`
- `src/sdk/residents.sdk.ts`
- `src/types/notices.ts`
- `src/types/residents.ts`
- `src/validations/notice.validation.ts`
- `src/validations/notification.validation.ts`

## Workspace-Only Report Files

These are untracked reports in the workspace and should not be merged unless explicitly desired:

- `CLEAN_BACKEND_MIGRATION_REPORT.md`
- `CLEAN_MIGRATION_PLAN.md`
- `FINAL_PRODUCTION_SIGNOFF.md`
- `KEEP_FILES_VALIDATION_REPORT.md`
- `MIGRATION_EXECUTION_ORDER.md`
- `PHASE_1_DATABASE_REPORT.md`
- `PHASE_2_BACKEND_REPORT.md`
- `PHASE_3_API_REPORT.md`
- `PHASE_4_PWA_REPORT.md`
- `PRODUCTION_DELTA_REPORT.md`
- `PRE_MERGE_PRODUCTION_AUDIT.md`

## Forbidden Path Verification

PASS: no candidate migration file matched these forbidden areas:

- `src/app/(public)/**`
- `src/components/public/**`
- `src/components/resident/**`
- `src/components/admin/**`
- `src/app/layout.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/(resident)/layout.tsx`
- `src/components/providers/**`
- image components
- translation components
- language switcher
- homepage, hero, gallery, facilities, testimonials, inquiry, navbar
- resident dashboard UI
- resident finance UI
- mobile navigation
- artifacts, browser profile files, Lighthouse files

## Dependency Audit

Files changed:

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`

Direct package additions in `package.json`:

- `web-push@^3.6.7`
  - Required for VAPID-backed Web Push notification delivery.
- `@types/web-push@^3.6.4`
  - Required for TypeScript coverage of `web-push`.

Script additions in `package.json`:

- `recovery:manual-backup`
- `recovery:manual-restore-db`
- `recovery:manual-restore-storage`
- `recovery:manual-validate`

Lockfile additions caused by `web-push` include:

- `asn1.js`
- `bn.js`
- `buffer-equal-constant-time`
- `ecdsa-sig-formatter`
- `http_ece`
- `jwa`
- `jws`
- `minimalistic-assert`
- `safe-buffer`
- `web-push`

Lockfile also adds `@next/third-parties` and `third-party-capital` entries. This is not a new direct dependency in `package.json`; `origin/main` already declares `@next/third-parties`, and the lockfile was missing the resolved package entry.

Dependency conclusion:

- No accidental UI/image/translation dependency was introduced.
- `web-push` and `@types/web-push` are expected.
- Lockfile should be reviewed once more before commit because it includes an existing `@next/third-parties` lock repair in addition to push dependencies.

## Migration Audit

### Ordering

PASS

Migration order is timestamped and dependency-safe:

1. `20260606001000_resident_notice_reads.sql`
   - Creates `notice_reads`.
2. `20260606002000_smart_notification_center.sql`
   - Adds notification category, priority, archive fields.
3. `20260606003000_notice_acknowledgements.sql`
   - Adds notice type/acknowledgement columns and creates `notice_acknowledgements`.
4. `20260606004000_pwa_push_subscriptions.sql`
   - Creates `push_subscriptions`.

### RLS

PASS with normal production caution

- `notice_reads`
  - Enables and forces RLS.
  - Policies allow Owner/Admin organization management or the linked resident owner.
- `notice_acknowledgements`
  - Enables and forces RLS.
  - Policies allow Owner/Admin organization management or the linked resident owner.
- `push_subscriptions`
  - Enables and forces RLS.
  - Select/update policies allow Owner/Admin or self.
  - Insert policy requires `auth.uid() = user_id` and `public.belongs_to_organization(organization_id)`.
- `notifications`
  - Migration changes columns/indexes only and relies on existing notifications RLS.

### Indexes

PASS

Added or updated indexes:

- `notice_reads_org_idx`
- `notice_reads_notice_idx`
- `notice_reads_resident_idx`
- `notifications_recipient_center_idx`
- `notifications_unread_center_idx`
- `notifications_archived_idx`
- `notices_type_status_idx`
- `notice_acknowledgements_org_idx`
- `notice_acknowledgements_notice_idx`
- `notice_acknowledgements_resident_idx`
- `push_subscriptions_user_active_idx`
- `push_subscriptions_resident_active_idx`
- `push_subscriptions_hostel_active_idx`

### Rollback Safety

REVIEW

The migrations are mostly additive:

- `create table if not exists`
- `add column if not exists`
- `create index if not exists`
- forced RLS and explicit policy replacement

Risks:

- There are no down migrations.
- The smart notification migration backfills new `category` and `priority` fields. This is low risk because the columns did not exist before, but rollback still requires a forward corrective migration rather than simply deleting deployed migration history.
- Production rollback should require a database backup and a planned reverse migration, especially before removing new columns/tables after application code has used them.

## API Audit

### Shared Route Wrapper

All new routes use `withApiRoute(...)`.

Shared behavior:

- Request tracing
- Request metrics
- Error normalization
- Same-origin mutation protection through `assertSameOriginMutation(request)`
- Optional rate-limit support

### `POST /api/notices/[id]/read`

Validation:

- Parses body through `markNoticeReadSchema`.
- Requires `organizationId`.

Authorization and tenant isolation:

- `NoticesService.markNoticeRead` calls `getCurrentContext()`.
- Requires organization access.
- Requires a linked resident profile in that organization.
- Loads notice by `noticeId` and `organizationId`.

Risk:

- NO-GO: service does not re-check `noticeTargetsResident(notice, resident)` before marking read.
- A resident with a valid same-organization session could mark a same-organization notice read if they know the notice ID, even if the notice targets another hostel/resident group.

Rate limiting:

- No explicit `rateLimit` option is configured on the route.

### `POST /api/notices/[id]/acknowledge`

Validation:

- Parses body through `acknowledgeNoticeSchema`.
- Requires `organizationId`.

Authorization and tenant isolation:

- Requires organization access.
- Requires linked resident profile.
- Loads notice by `noticeId` and `organizationId`.
- Rejects notices that do not require acknowledgement.

Risk:

- NO-GO: service does not re-check `noticeTargetsResident(notice, resident)` before acknowledging.
- Same issue as notice read: org-level isolation exists, but audience/hostel-level authorization is incomplete.

Rate limiting:

- No explicit `rateLimit` option is configured on the route.

### `POST /api/notifications/[id]/archive`

Validation:

- Parses body through `archiveNotificationSchema`.
- Requires `organizationId`.

Authorization and tenant isolation:

- Requires organization access.
- Repository update filters by `notificationId`, `organizationId`, and `recipientUserId`.

Risk:

- Low. Archive is user-scoped through `recipient_user_id`.

Rate limiting:

- No explicit `rateLimit` option is configured on the route.

### `POST /api/notifications/push-subscriptions`

Validation:

- Parses body through `subscribePushSchema`.
- Validates organization, optional hostel, endpoint URL, key lengths, user agent, platform, and device label.
- Database check constraint requires endpoint to match `^https://`.

Authorization and tenant isolation:

- Requires current authenticated context.
- Requires organization access.
- If resident exists, stores resident and hostel from resident profile.
- If `hostelId` is supplied for non-resident context, resolves hostel access through `resolveHostelScope`.

Risks:

- No explicit route rate limit.
- Endpoint is globally unique and upserted using an admin repository. Browser push endpoints are high-entropy credentials, but known endpoint overwrite behavior should be accepted or constrained.

Rate limiting:

- No explicit `rateLimit` option is configured on the route.

### `POST /api/notifications/push-subscriptions/revoke`

Validation:

- Parses body through `revokePushSubscriptionSchema`.
- Optional endpoint URL.

Authorization and tenant isolation:

- Revokes only records with `user_id = current user`.
- Optional endpoint narrows revoke target.

Risk:

- Low to medium. No explicit route rate limit, but action is self-scoped.

Rate limiting:

- No explicit `rateLimit` option is configured on the route.

## Production Risk Audit

### Breaking Changes

NO-GO finding:

`updateNoticeSchema` currently applies defaults during partial updates.

Proof command:

```bash
npx tsx -e "import { updateNoticeSchema } from './src/validations/notice.validation.ts'; const r = updateNoticeSchema.parse({ noticeId: '00000000-0000-4000-8000-000000000001', organizationId: '00000000-0000-4000-8000-000000000002', title: 'Hello' }); console.log(JSON.stringify(r));"
```

Observed output:

```json
{"title":"Hello","status":"draft","noticeType":"general","requiresAcknowledgement":false,"audienceType":"all","audienceFilter":{},"isPinned":false,"noticeId":"00000000-0000-4000-8000-000000000001","organizationId":"00000000-0000-4000-8000-000000000002"}
```

Impact:

- Updating an existing notice without explicitly sending `noticeType` and `requiresAcknowledgement` can reset those fields.
- Existing admin notice UI on `origin/main` does not send those new fields.
- This can silently turn acknowledgement-required notices into non-acknowledgement notices and reset notice type to `general`.

Required fix before merge:

- Build `updateNoticeSchema` so partial update fields do not apply create defaults.
- Preserve existing database values when update payload omits new fields.
- Add a unit test proving omitted update fields stay omitted.

### Schema Compatibility

PASS for migrations, NO-GO for notice update payload compatibility.

Schema migrations are additive and defaulted:

- Existing notices get default `notice_type = 'general'`.
- Existing notices get default `requires_acknowledgement = false`.
- Existing notifications get default category/priority and archive fields.
- New tables do not affect existing rows until code writes them.

Compatibility blocker is application-level update parsing, not SQL.

### Backward Compatibility

NO-GO until notice update parsing is fixed.

Other backward-compatibility notes:

- New read/ack routes are additive.
- New notification archive route is additive.
- Push subscription APIs are additive.
- Resident profile enrichment is additive.
- Owner analytics metrics are additive.
- PWA manifest/service worker changes are additive, but registration/mounting is not included in this branch.

### Deployment Risk

Medium.

Conditions to manage:

- Fix notice update defaulting before merge.
- Fix or formally accept notice read/ack audience authorization gap.
- Add explicit rate limits or document why authenticated same-origin endpoints are exempt.
- Configure deployment VAPID keys before live Web Push.
- Confirm service worker registration/mounting plan if PWA install/offline behavior is expected immediately.
- Apply migrations in order with backup/restore path available.
- Treat rollback as forward-only/manual after production data writes begin.

## Validation Evidence

From `CLEAN_BACKEND_MIGRATION_REPORT.md`, final validation passed after migration:

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run test`: PASS, 504 tests passed, 5 skipped
- `npm run test:security`: PASS, 69 tests passed, 3 skipped
- `npm run build`: PASS

This audit did not rerun the full validation suite.

## Required Pre-Merge Actions

1. Fix `updateNoticeSchema` so partial updates do not apply create defaults.
2. Add or update tests proving notice update payloads can omit `noticeType`, `requiresAcknowledgement`, `audienceType`, `audienceFilter`, and `isPinned` without resetting existing values.
3. Add notice read/ack audience authorization checks, likely using `noticeTargetsResident(notice, resident)`.
4. Add tests proving residents cannot read or acknowledge notices outside their hostel/audience/selected-resident target.
5. Decide whether to add explicit `rateLimit` options to new write routes, especially push subscription subscribe/revoke.
6. Review package lockfile changes and confirm the `@next/third-parties` lock repair should travel with this branch.
7. Configure VAPID env vars before production Web Push smoke testing:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - optional `VAPID_SUBJECT` or `VAPID_CONTACT_EMAIL`
8. Commit the migration set before merge; the branch HEAD currently equals `origin/main`.

## MERGE_DECISION

NO-GO

Detailed reasoning:

- The branch is clean from forbidden UI/provider/layout/artifact changes.
- Database migrations are ordered, additive, indexed, and RLS-protected.
- Required validation previously passed.
- However, current notice update validation can silently reset newly added notice fields during partial updates from existing UI callers.
- Notice read/acknowledgement APIs enforce organization and resident identity, but do not re-check resident audience/hostel targeting before writing read or acknowledgement state.
- New write APIs do not configure explicit route-level rate limits.
- The branch has not been committed yet; `backend-feature-migration` HEAD is still `origin/main`.

Merge only after the required pre-merge actions above are resolved and validation is rerun.
