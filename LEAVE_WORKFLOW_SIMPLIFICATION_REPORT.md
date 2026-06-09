# Leave Workflow Simplification Report

## Problem

The resident leave workflow required more effort than the real student task needed. The old form emphasized travel details and profile readiness, while the fast path should be: name, mobile number, WhatsApp number, dates, reason, submit.

## UX Improvements

- Rebuilt the resident leave form around six required fields: Full Name, Mobile Number, WhatsApp Number, From Date, To Date, and Reason.
- Kept Emergency Notes as the only optional field in the primary form.
- Removed travel mode and destination from the resident submission path.
- Added the required review notice above submission:
  "Leave requests are usually reviewed within 1–2 days. Please submit your request as early as possible."
- Added a "Need urgent approval?" section with a WhatsApp escalation button.
- Added post-submit visibility with "Leave Submitted Successfully", status, and estimated review time.
- Preserved pending escalation from the success panel and pending leave history.
- Saved submitted name, mobile, and WhatsApp values into leave request metadata for admin review.

## Files Changed

- `src/components/resident/resident-leave-client.tsx`
- `src/components/admin/settings/admin-settings-client.tsx`
- `src/components/admin/leaves/admin-leaves-client.tsx`
- `src/app/api/leaves/settings/route.ts`
- `src/services/leaves.service.ts`
- `src/validations/leave.validation.ts`
- `src/sdk/leaves.sdk.ts`
- `src/hooks/use-leaves.ts`
- `src/lib/react-query/query-keys.ts`
- `src/lib/leaves/settings.ts`
- `src/tests/unit/validations/leave.validation.test.ts`
- `src/tests/unit/services/leaves.service.test.ts`
- `src/tests/unit/lib/leave-settings.test.ts`
- `src/tests/unit/components/leave-workflow-simplification-static.test.ts`

## Before vs After Flow

Before:
1. Open leave page.
2. Clear profile/access friction.
3. Enter dates.
4. Enter travel details.
5. Enter destination.
6. Enter reason.
7. Submit and rely mostly on history for status.

After:
1. Open leave page.
2. Enter or confirm Full Name.
3. Enter or confirm Mobile Number.
4. Enter or confirm WhatsApp Number.
5. Select From Date and To Date.
6. Enter Reason.
7. Submit.

## Mobile Improvements

- One-column resident form.
- Large 48px form controls and submit button.
- Sticky submit area on mobile.
- No mobile table; leave history uses mobile cards.
- Escalation and notice sections are visible before submission.
- Added `min-w-0` and responsive grid constraints to avoid horizontal scrolling.

## Admin Configuration

Added "Leave Management Settings" in admin Settings:

- WhatsApp Support Number
- Leave Review Notice
- Enable Urgent Leave WhatsApp Escalation

The resident screen reads these settings through `/api/leaves/settings`. Existing organization settings are merged, so unrelated settings are preserved.

## Tests Added

- Leave settings defaults, operational WhatsApp fallback, and urgent message formatting.
- Leave service creation with simplified contact metadata.
- Leave settings service read from organization settings.
- Resident leave UI static guard for simplified fields, notice, WhatsApp escalation, sticky submit, and status visibility.
- Admin settings static guard for leave management configuration.

## Validation Results

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run test`: PASS, 150 files passed, 3 skipped; 625 tests passed, 5 skipped.
- `npm run test:security`: PASS, 8 files passed, 2 skipped; 74 tests passed, 3 skipped.
- `npm run build`: PASS. The first attempt was blocked by an already-running Next build; after that process finished, the rerun completed successfully. Build emitted existing `hostel_rules` schema-cache log errors during static generation, but exited with status 0.

## Success Criteria

The resident leave path now supports a sub-30-second flow:

1. Open Leave Page.
2. Enter Name.
3. Enter Number.
4. Enter WhatsApp Number.
5. Select Dates.
6. Enter Reason.
7. Submit.

Urgent leave requests can be escalated through WhatsApp when admin configuration provides a support number and enables escalation.
