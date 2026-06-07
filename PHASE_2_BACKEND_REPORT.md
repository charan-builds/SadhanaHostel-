# Phase 2 Backend Logic Report

Date: 2026-06-07

Scope: `PHASE_2_BACKEND_LOGIC`

Allowed file classes:

- repositories
- services
- types
- validations
- SDKs

Forbidden areas:

- components
- layouts
- providers
- pages
- styling

## Summary

Phase 2 backend logic for the requested KEEP groups is present and validated on the current branch.

Requested backend areas covered:

- notices
- notice acknowledgements
- smart notifications
- analytics backend
- resident enrichment
- support permission fixes

No UI, layout, provider, page, component, or styling files were modified during this phase.

Note: the current branch still contains inherited `ui-recovery` deltas outside this phase, including UI/provider/page/PWA/API changes. They were not modified by this Phase 2 task. A clean migration branch should bring over only the backend files listed below for this phase.

## Backend Files Migrated / Verified

### Repositories

- `src/repositories/notice-reads.repository.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/repositories/notifications.repository.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/repositories/residents.repository.ts`
- `src/repositories/index.ts`

Implemented backend behavior:

- notice read upserts and read-count lookup
- notice acknowledgement upserts and acknowledgement-count lookup
- acknowledgement-required notice listing
- notification category/priority/archive filtering
- notification archive persistence
- notice recipient/read stats
- communication analytics aggregation
- reminder dedupe lookup support
- push subscription storage support
- resident current-room lookup

### Services

- `src/services/notices.service.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/notifications/types.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/pwa/web-push.service.ts`
- `src/services/auth.service.ts`
- `src/services/analytics.service.ts`
- `src/services/residents.service.ts`
- `src/services/support.service.ts`

Implemented backend behavior:

- resident notice mark-read
- resident notice acknowledgement
- selected-resident notice targeting
- notice-to-notification category and priority fanout
- notification archive service method
- notification category/priority stamping
- push handoff from notification queueing
- push subscription subscribe/revoke service methods
- logout push subscription revocation
- owner communication analytics metrics
- current resident room enrichment
- operational alerts Owner/Admin permission fix

### Types

- `src/types/database.ts`
- `src/types/notices.ts`
- `src/types/residents.ts`
- `src/services/notifications/types.ts`

Implemented type coverage:

- notice engagement/read state
- notice acknowledgement state
- notification category/priority fields
- archived notification fields
- owner communication analytics payload
- current resident room fields
- push subscription database table shape

### Validations

- `src/validations/notice.validation.ts`
- `src/validations/notification.validation.ts`
- `src/validations/pwa.validation.ts`

Implemented validation coverage:

- notice type
- acknowledgement-required flag
- selected-resident targeting
- mark-read payloads
- acknowledgement payloads
- notification category filters
- notification priority filters
- notification archive payloads
- push subscription and revoke payloads

### SDKs

- `src/sdk/notices.sdk.ts`
- `src/sdk/notifications.sdk.ts`
- `src/sdk/analytics.sdk.ts`
- `src/sdk/residents.sdk.ts`

Implemented SDK/client-contract coverage:

- notice mark-read
- notice acknowledgement
- notification archive
- push subscribe/revoke client contracts
- owner communication analytics type shape
- current resident room enrichment type shape

## Backend Dependency Helpers

The implementation also depends on backend helper modules that are outside the strict repository/service/type/validation/SDK categories but are required by the verified backend graph:

- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`
- `src/lib/notifications/catalog.ts`

These helpers provide:

- selected-resident notice audience checks
- emergency/maintenance/fee-update notice classification
- notification category/priority catalog
- payment reminder priority helpers

## Hidden Dependencies

Important dependency findings:

- `NotificationService` imports `WebPushService`; therefore smart notification service changes need `src/services/pwa/web-push.service.ts`, `src/repositories/push-subscriptions.repository.ts`, `src/validations/pwa.validation.ts`, and `web-push` dependencies to compile.
- `AuthService` imports `PushSubscriptionsRepository` for logout subscription revocation.
- `NoticesService` requires `NoticeReadsRepository`, `NoticeAcknowledgementsRepository`, `noticeTargetsResident`, and `noticeNotificationClassification`.
- `AnalyticsService` requires notice acknowledgement counts, notice recipient/read stats, and communication analytics from repositories.
- `ResidentsService` requires `ResidentsRepository.getCurrentRoomAssignment`.
- `SupportService.getOperationalAlerts` requires the existing `ADMIN_PORTAL_ROLES` authorization path and admin-scoped aggregate reads.

## Explicitly Not Implemented In This Phase

No changes were made to:

- UI components
- route layouts
- app providers
- pages
- styling
- public homepage
- resident dashboard UI
- resident finance UI
- dashboard notification bell UI
- PWA install prompt UI
- API routes
- background jobs
- tests

Out-of-phase inherited backend REVIEW files still exist on the current branch but were not touched as Phase 2 deliverables:

- `src/services/platform.service.ts`
- `src/sdk/platform.sdk.ts`
- `src/validations/platform.validation.ts`

These belong to the optional branding upload backend review, not the requested Phase 2 backend set.

## Validation Results

### Backend Patch Hygiene

Command:

```bash
git diff --check origin/main..HEAD -- src/repositories src/services src/types src/validations src/sdk src/lib/notices src/lib/notifications
```

Result: PASS.

### Dependency Check

Command:

```bash
npm ls web-push @types/web-push --depth=0
```

Result: PASS.

Installed:

```text
@types/web-push@3.6.4
web-push@3.6.7
```

### Lint

Command:

```bash
npm run lint
```

Result: PASS.

### Typecheck

Initial command:

```bash
npm run typecheck
```

Initial result: FAIL due to corrupted generated `.next/dev` cache files:

- `.next/dev/types/link.d.ts`
- `.next/dev/types/routes.d.ts`
- `.next/dev/types/validator.ts`

Recovery action:

```bash
rm -rf .next/dev
npm run typecheck
```

Final result: PASS.

No tracked source files were changed by clearing `.next/dev`; it is generated cache.

## Current Working Tree Status

Only report files are untracked in the working tree. No tracked source edits were made during this phase.

Untracked reports include:

- `CLEAN_MIGRATION_PLAN.md`
- `KEEP_FILES_VALIDATION_REPORT.md`
- `MIGRATION_EXECUTION_ORDER.md`
- `PHASE_1_DATABASE_REPORT.md`
- `PHASE_2_BACKEND_REPORT.md`
- `PRODUCTION_DELTA_REPORT.md`

## GO / NO-GO

GO for Phase 2 backend logic validation.

Reason:

- Requested backend files are present.
- Repository/service/type/validation/SDK logic compiles.
- Lint passes.
- Typecheck passes after clearing corrupted generated `.next/dev` cache.

NO-GO for full production migration until:

- API routes are migrated and validated in the next phase.
- Tests are migrated and run in the tests phase.
- Out-of-phase UI/provider/page deltas from `ui-recovery` are excluded from the clean production branch.
