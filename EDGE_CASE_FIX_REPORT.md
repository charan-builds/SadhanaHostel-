# Edge Case Fix Report

Date: 2026-06-07

Branch: `backend-feature-migration`

Mode: implementation for edge-case fixes. No UI, layout, provider, styling, image, translation, migration, or package files were modified by this pass.

## Summary

Implemented the real P1 edge case found in the current backend notice flow:

- Room-targeted notices were accepted by schema/database and supported by RLS, but service-side resident read/acknowledgement/fanout checks did not evaluate active room assignment.
- Role-targeted notices were accepted by schema/database and supported by RLS, but service-side targeting did not evaluate resident roles for read/acknowledgement/fanout.
- Role audience filters accepted arbitrary strings, which could create notices that were syntactically valid but never matched a real application role.

## Files Changed

- `src/lib/notices/audience.ts`
- `src/repositories/residents.repository.ts`
- `src/services/notices.service.ts`
- `src/validations/notice.validation.ts`
- `src/tests/unit/services/notices.service.test.ts`

## Fixes Applied

### Notice Audience Targeting

Before:

- `noticeTargetsResident` handled `all`, `hostel`, and `residents`.
- `room` and `roles` returned false, so valid room/role notices failed closed in read, acknowledgement, and fanout paths.

After:

- `room` notices match the resident's current active room allocation.
- `roles` notices match the resident's resolved application roles.
- Unsupported audience types still fail closed.

### Active Room Resolution

Before:

- Resident current room enrichment returned display data, but not the underlying `room_id`.
- Fanout could not efficiently evaluate room-targeted notices across residents.

After:

- `getCurrentRoomAssignment` now includes `roomId`.
- `listActiveRoomIdsByResidentIds` loads active room ids for notice fanout in one repository call.

### Role Filter Validation

Before:

- `audienceFilter.roles` accepted arbitrary strings.

After:

- `audienceFilter.roles` accepts only known app roles from the database enum.
- Duplicate role entries are normalized.

## Before / After Behavior

Before:

- A published notice targeted to a room could be listed through database/RLS but could not be marked read or acknowledged by an assigned resident.
- A room-targeted notice would not fan out notifications to residents in that room.
- A role-targeted resident notice could be saved with invalid role strings.

After:

- Residents assigned to a targeted room can mark the notice read and acknowledge it.
- Residents outside the targeted room are denied before notification/read/ack writes.
- Resident role notices fan out to resident recipients.
- Invalid role audience filters are rejected during validation.

## Tests Added

- Role audience filters accept known app roles and reject unknown roles.
- Room notices fan out only to residents with active allocations in selected rooms.
- Role notices fan out to resident recipients.
- Residents assigned to selected rooms can mark notices read.
- Residents outside selected rooms cannot mark notices read.
- Residents with matching roles can acknowledge role-targeted notices.

## Validation Results

Focused validation:

```text
npm run test -- src/tests/unit/services/notices.service.test.ts
Test Files  1 passed (1)
Tests       19 passed (19)
```

Full validation:

```text
npm run lint
PASS
```

```text
npm run typecheck
PASS
```

```text
npm run test
Test Files  108 passed | 3 skipped (111)
Tests       516 passed | 5 skipped (521)
```

```text
npm run test:security
Test Files  7 passed | 2 skipped (9)
Tests       69 passed | 3 skipped (72)
```

```text
npm run build
PASS
Compiled successfully
Generated static pages using 15 workers (37/37)
```

## Remaining Edge Risks

- Room/role targeting now works for resident read, acknowledgement, and fanout paths.
- Parent-targeted notice semantics remain unchanged; this release still centers notice read/ack on linked resident users.
- No migration was required.

## Final Decision

GO

The identified P1 notice audience edge case is fixed and validated.
