# Final Release Audit

Date: 2026-06-07

Branch: `backend-feature-migration`

Baseline: `origin/main`

Mode: read-only production backend audit, except for generating this report. No source code was modified, no commits were created, and no branch changes were made.

## Result

GO

Release risk: MEDIUM

No real backend production blockers remain after the blocker fixes documented in `BLOCKER_FIX_REPORT.md`.

## Audit Basis

This audit treats the current uncommitted working tree on `backend-feature-migration` as the release candidate because the branch HEAD still matches `origin/main`.

Validation evidence from `BLOCKER_FIX_REPORT.md` after the blocker fixes:

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run test`: PASS, 508 passed and 5 skipped
- `npm run test:security`: PASS, 69 passed and 3 skipped
- `npm run build`: PASS

This final audit did not rerun the full suite because the user requested a read-only release audit.

## Security

### Tenant Isolation

Status: PASS

- New notice read and acknowledgement flows require current auth context.
- Both flows require organization access before loading resident or notice data.
- Notices are loaded by `noticeId` and `organizationId`.
- Notification archive updates are scoped by notification id, organization id, and current `recipient_user_id`.
- Push subscription revoke updates are scoped to the current authenticated `user_id`.

### RLS Assumptions

Status: PASS

- `notice_reads` enables and forces RLS.
- `notice_acknowledgements` enables and forces RLS.
- `push_subscriptions` enables and forces RLS.
- Policies allow Owner/Admin organization management or resident/self ownership as appropriate.
- Existing `notifications` RLS remains in place; the smart-notification migration adds columns and indexes only.

### Admin Repository Usage

Status: PASS

- Admin-scoped notice read, acknowledgement, notification, and push writes are reached only after service-level auth checks.
- Notice read and acknowledgement writes occur only after organization access, linked resident lookup, notice lookup, and audience targeting checks.
- Notification archive uses the admin repository but filters by current user recipient id.
- Web Push delivery uses admin repositories for system delivery and logs, scoped from an already-created notification row.

### Service Authorization

Status: PASS

- Notice management still requires `notices.manage`.
- Notice read and acknowledgement require an authenticated resident in the organization.
- Notification center operations require organization access and current-user recipient scoping.
- Analytics backend still requires `analytics.view`.
- Support operational alerts retain admin portal role and hostel access checks before admin-scoped aggregate reads.
- Resident profile enrichment remains tied to the current resident lookup.

### Notice Read Authorization

Status: PASS

- `markNoticeRead` now calls `noticeTargetsResident(notice, resident)` before marking notifications or notice read rows.
- Residents outside the notice hostel/audience are denied.
- Tests prove unauthorized selected-resident read attempts do not call write repositories.

### Notice Acknowledgement Authorization

Status: PASS

- `acknowledgeNotice` now calls `noticeTargetsResident(notice, resident)` before acknowledgement checks and writes.
- Residents outside the notice hostel/audience are denied.
- Tests prove unauthorized acknowledgement attempts do not call notification, read, or acknowledgement repositories.

### Push Subscription Authorization

Status: PASS

- Subscribe requires current auth context and organization access.
- Resident users are tied to their resident profile and hostel.
- Non-resident hostel scope is resolved through existing hostel access checks when supplied.
- Stored `user_id` is always the current authenticated user.
- Revoke can only revoke subscriptions for the current authenticated user, optionally narrowed by endpoint.
- Database constraints require HTTPS push endpoints.

Security note:

- New write APIs do not configure explicit route-level rate limits. Because they require authenticated same-origin requests and service-level tenant/user authorization, this is not a release blocker for backend safety. It remains a hardening follow-up.

## Backward Compatibility

### Existing Notice Edit Flows

Status: PASS

- `updateNoticeSchema` is now an explicit partial update schema.
- Omitted update fields stay omitted and do not receive create defaults.
- `NoticesService.updateNotice` sends only explicitly supplied fields plus `updated_by`.
- Existing UI/API callers that update only title/body/status will not reset `noticeType`, `requiresAcknowledgement`, `audienceType`, `audienceFilter`, or `isPinned`.
- Create defaults are preserved for create flows.

### Existing Notification Flows

Status: PASS

- Notification category, priority, and archive fields are additive and defaulted.
- Existing notification list, mark-read, and mark-all-read flows remain current-user scoped.
- Archive is additive and only affects records explicitly archived by the current user.
- Web Push send attempts are skipped when VAPID config is missing.

### Existing Resident APIs

Status: PASS

- Current resident profile room assignment fields are additive:
  - `current_room_allocation_id`
  - `current_room_number`
  - `current_room_name`
- Existing resident response fields are preserved.
- Residents without an active room assignment receive null values for the new fields.

### Existing Analytics APIs

Status: PASS

- Owner analytics communication metrics are additive.
- Analytics service still requires `analytics.view`.
- Existing analytics SDK methods remain present.
- New notice and notification metrics depend on additive migrations and repositories.

## Migration Safety

### Ordering

Status: PASS

Migration order is dependency-safe:

1. `20260606001000_resident_notice_reads.sql`
2. `20260606002000_smart_notification_center.sql`
3. `20260606003000_notice_acknowledgements.sql`
4. `20260606004000_pwa_push_subscriptions.sql`

### Additive Schema

Status: PASS

- New tables use `create table if not exists`.
- New columns use `add column if not exists`.
- New indexes use `create index if not exists`.
- Existing notification rows are backfilled only for new category and priority columns.
- Notice acknowledgement columns are defaulted for existing notices.

### Indexes

Status: PASS

Indexes exist for:

- Notice reads by organization/hostel, notice, and resident.
- Smart notification center recipient, unread, and archived views.
- Notice type/status lookup.
- Notice acknowledgements by organization/hostel, notice, and resident.
- Active push subscriptions by user, resident, and hostel.

### Destructive SQL

Status: PASS

- No `drop table`.
- No `drop column`.
- No `delete from`.
- No `truncate`.
- Policy and trigger replacement uses `drop ... if exists` followed by recreation.

### Rollback Strategy

Status: REVIEW, not a blocker

- Migrations are forward-only and do not include down migrations.
- Production rollback should use a database backup plus a planned forward corrective migration.
- After production writes begin, removing new tables or columns should be treated as a separate data-retention decision.

## Production Dependencies

### VAPID Requirements

Status: PASS with deployment prerequisite

Required for live Web Push delivery:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- Optional `VAPID_SUBJECT` or `VAPID_CONTACT_EMAIL`

No local `.env*` file currently contains VAPID keys. This is not a code blocker because Web Push delivery skips when VAPID config is missing. It is a deployment prerequisite for live push smoke testing.

### Package Additions

Status: PASS

Direct package additions:

- `web-push`: required for VAPID-backed Web Push delivery.
- `@types/web-push`: required for TypeScript support.

Lockfile note:

- `package-lock.json` also repairs the existing `@next/third-parties` resolved entry. It is not a new direct runtime dependency in `package.json`.

### Cron Jobs

Status: PASS with monitoring recommendation

- Payment reminder scheduling now uses a seven-day lookahead and smarter reminder windows.
- Reminder deduplication reduces duplicate sends by template, resident, fee record, and run date.
- Production should monitor first-run reminder volume after deploy.

### Service Worker Deployment

Status: PASS with operational prerequisite

- `public/sw.js` is present.
- `next.config.ts` serves `/sw.js` with JavaScript content type, no-store cache headers, and `Service-Worker-Allowed: /`.
- Full PWA install/offline behavior still depends on the intended registration/mounting strategy, which is outside this backend-only audit scope.

### DR Tooling

Status: PASS with credential prerequisite

Manual DR scripts require:

- `pg_dump`
- `psql`
- `rclone`
- Google Drive remote configuration
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Restore-target equivalents for isolated restore validation

## Release Risk

Classification: MEDIUM

Reasons:

- New production database tables and additive columns require ordered migration execution.
- Web Push introduces external delivery behavior when VAPID keys are configured.
- Payment reminder timing changes can affect resident communication volume.
- Rollback is forward-only/manual after production writes begin.

Risk reducers:

- Forbidden UI/provider/layout/public/resident changes are absent from the backend release candidate.
- Blocker fixes are implemented and tested.
- Full lint, typecheck, test, security test, and build validation passed after blocker fixes.
- Migrations are additive, indexed, and RLS-protected.
- Existing notice update compatibility is fixed.

## Real Blockers

None found.

## Operational Conditions Before Merge Or Deploy

These are not merge blockers, but should be handled during release:

- Commit the migration set before merge.
- Run migrations in timestamp order.
- Take or verify a production database backup before applying migrations.
- Configure VAPID keys before expecting live push delivery.
- Smoke test notice read, notice acknowledgement, notification archive, push subscribe/revoke, owner analytics, resident current profile, and payment reminders in staging.
- Monitor first production payment-reminder run.

## FINAL_RELEASE_DECISION

GO

The backend migration is production-safe to merge from a backend security and compatibility perspective. Release risk is MEDIUM and operationally manageable.
