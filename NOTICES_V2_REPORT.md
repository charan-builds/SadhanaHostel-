# Notices V2 Report

Date: 2026-06-08

Branch: `backend-feature-migration`

Mode: implementation for notice read tracking, acknowledgements, engagement visibility, and audience targeting usability.

## Summary

Upgraded the notice experience using existing notice APIs and schema. No backend route, database schema, authorization, tenant-isolation, or notification fanout behavior was changed.

Residents can now mark notices as read and acknowledge notices that require confirmation. Admins can now require acknowledgement, choose notice type, filter by audience, and see read/acknowledgement engagement from the existing notice engagement fields.

## Problem Found

The backend already supported read tracking, acknowledgement tracking, notice type, audience filters, and engagement stats, but the UI did not expose those capabilities clearly enough.

## Root Cause

Resident notice cards were mostly passive. Admin notice creation omitted key backend-supported fields, and the list did not summarize engagement or pending acknowledgements.

## Files Changed

- `src/hooks/use-notices.ts`
- `src/components/resident/resident-notices-client.tsx`
- `src/components/admin/notices/admin-notices-client.tsx`
- `src/tests/unit/components/notices-v2-static.test.ts`
- `NOTICES_V2_REPORT.md`
- `MASTER_PRODUCT_EVOLUTION_REPORT.md`

## Code Implemented

- Added `useMarkNoticeRead` and `useAcknowledgeNotice` hooks over existing notice SDK methods.
- Added resident notice read/unread badges.
- Added resident `Mark as read` and `Acknowledge notice` actions.
- Added resident acknowledgement-required and acknowledged states.
- Added admin notice audience filter.
- Added admin read-rate and pending-acknowledgement metrics.
- Added admin notice type and requires-acknowledgement editor controls.
- Added per-notice engagement summaries for read count, recipient count, acknowledgement count, pending count, and engagement percentages.

## Before / After Behavior

Before:

- Residents could read notices but had no clear inline read/acknowledgement actions.
- Admins could publish notices but could not easily require acknowledgement from the editor.
- Admins could not scan read rate or pending acknowledgement state from the notice list.

After:

- Residents can act on notices directly.
- Acknowledgement-required notices are visually distinct.
- Admins can publish notices with acknowledgement requirements and notice types.
- Admins can review engagement and pending confirmations without opening analytics.

## Tests Added

- `src/tests/unit/components/notices-v2-static.test.ts`

Coverage includes:

- resident read/acknowledgement actions
- admin acknowledgement controls
- admin notice type controls
- admin audience filtering
- admin engagement metrics
- notice read/ack mutation hooks

## Validation Results

Focused test:

```text
npm run test -- src/tests/unit/components/notices-v2-static.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)
```

Full gate:

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
Test Files  127 passed | 3 skipped (130)
Tests       556 passed | 5 skipped (561)
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

## Risk Assessment

- GO for this notices batch.
- No schema, API, notification fanout, permission, or tenant-isolation changes were made.
- Risk is low because the UI now exposes backend-supported fields and existing SDK methods.
