# Blocker Fix Report

Date: 2026-06-07

Branch: `backend-feature-migration`

Scope: fixed only the blockers identified in `PRE_MERGE_PRODUCTION_AUDIT.md`.

Mode: implementation plus validation. No providers, layouts, components, pages, homepage, resident dashboard, finance UI, translations, images, or PWA UI files were modified.

## Result

GO

The three requested blockers are fixed and the required validation suite passed.

## Files Changed For This Fix

- `src/validations/notice.validation.ts`
- `src/services/notices.service.ts`
- `src/tests/unit/services/notices.service.test.ts`

## Task 1: Fix `updateNoticeSchema`

Status: FIXED

Problem:

- `updateNoticeSchema` was derived from `createNoticeSchema.partial()`.
- Zod defaults from create payloads still applied during updates.
- A title-only update could silently reset:
  - `noticeType`
  - `requiresAcknowledgement`
  - `audienceType`
  - `audienceFilter`
  - `isPinned`

Fix:

- Rebuilt `updateNoticeSchema` as its own explicit partial update object.
- Update fields are optional and omitted fields remain absent/undefined.
- `CreateNoticeInput` still uses create schema input defaults.
- `UpdateNoticeInput` remains update schema input.

Proof:

```bash
npx tsx -e "import { updateNoticeSchema } from './src/validations/notice.validation.ts'; const r = updateNoticeSchema.parse({ noticeId: '00000000-0000-4000-8000-000000000001', organizationId: '00000000-0000-4000-8000-000000000002', title: 'Hello' }); console.log(JSON.stringify(r));"
```

Output:

```json
{"noticeId":"00000000-0000-4000-8000-000000000001","organizationId":"00000000-0000-4000-8000-000000000002","title":"Hello"}
```

Service behavior:

- `NoticesService.updateNotice` now builds a `TablesUpdate<"notices">` object with only explicitly supplied fields plus `updated_by`.
- Omitted update fields are not passed to the repository.
- Existing database values are preserved when fields are omitted.

Tests added:

- Update schema title-only payload does not include defaulted notice fields.
- Service title-only update sends only `title` and `updated_by`.

## Task 2: Fix Notice Read Authorization

Status: FIXED

Problem:

- `markNoticeRead` verified authentication, organization access, resident linkage, and notice organization.
- It did not verify that the resident was targeted by the notice audience.

Fix:

- `markNoticeRead` now calls `noticeTargetsResident(notice, resident)` before marking read.
- Residents outside the notice audience receive `forbidden("Notice is not available for this resident.")`.
- Admin-scoped notification/read writes do not run for unauthorized residents.

Tests added:

- Resident cannot mark a selected-resident notice read when their resident ID is not in the notice audience.
- Test verifies notification/read repositories are not called.

## Task 3: Fix Notice Acknowledgement Authorization

Status: FIXED

Problem:

- `acknowledgeNotice` verified authentication, organization access, resident linkage, notice organization, and acknowledgement requirement.
- It did not verify that the resident was targeted by the notice audience.

Fix:

- `acknowledgeNotice` now calls `noticeTargetsResident(notice, resident)` before acknowledgement checks and writes.
- Residents outside the notice audience receive `forbidden("Notice is not available for this resident.")`.
- Notification read, notice read, and acknowledgement writes do not run for unauthorized residents.

Tests added:

- Resident cannot acknowledge a required notice scoped to another hostel.
- Test verifies notification/read/acknowledgement repositories are not called.

## Validation Results

Focused test:

```bash
npm run test -- src/tests/unit/services/notices.service.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       13 passed (13)
```

Required validation:

```bash
npm run lint
```

PASS

```bash
npm run typecheck
```

PASS

```bash
npm run test
```

PASS

```text
Test Files  108 passed | 3 skipped (111)
Tests       508 passed | 5 skipped (513)
```

```bash
npm run test:security
```

PASS

```text
Test Files  7 passed | 2 skipped (9)
Tests       69 passed | 3 skipped (72)
```

```bash
npm run build
```

PASS

```text
✓ Compiled successfully
✓ Generating static pages using 15 workers (37/37)
```

## Forbidden File Audit

PASS

No blocker-fix changes were made in:

- providers
- layouts
- components
- pages
- homepage
- resident dashboard
- finance UI
- translations
- images
- PWA UI

## Remaining Notes

- Route-level rate limiting was not changed because the allowed file scope excluded API routes and the requested tasks were limited to validation/service/test blockers.
- VAPID deployment configuration remains an operational prerequisite for live Web Push delivery.
- The migration branch still needs a commit before merge; branch HEAD itself is still at `origin/main`.

## Final Section

GO

The requested pre-merge blockers are fixed, covered by tests, and validated by lint, typecheck, full test suite, security tests, and production build.
