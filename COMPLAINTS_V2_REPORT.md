# Complaints System V2 Report

Date: 2026-06-08

Branch: `backend-feature-migration`

Mode: implementation for complaint/support SLA tracking, escalation visibility, timelines, and priority clarity.

## Summary

Transformed the existing complaint/support workflow using current `support_requests` data. No APIs, backend routes, business rules, database schema, authorization, or tenant isolation were changed.

Residents now see response targets and SLA state on their support timeline. Admins now see SLA state, escalation flags, target response times, and a one-click `Start review` action in the operational support queue.

## Problem Found

Support requests already had category, priority, status, and timestamps, but neither residents nor staff could easily tell whether a complaint was still within target response time, close to breach, overdue, waiting on the resident, or escalated.

## Root Cause

SLA and escalation logic was implicit. The UI displayed raw priority/status values but did not turn existing request metadata into operational guidance.

## Files Changed

- `src/lib/support/complaint-insights.ts`
- `src/components/resident/resident-support-client.tsx`
- `src/components/admin/support/admin-operational-alerts-client.tsx`
- `src/tests/unit/lib/support/complaint-insights.test.ts`
- `COMPLAINTS_V2_REPORT.md`
- `MASTER_PRODUCT_EVOLUTION_REPORT.md`

## Code Implemented

- Added a pure complaint-insights model that maps request priority/status/created time to SLA state.
- Added priority response windows:
  - urgent: 4h
  - high: 8h
  - medium: 24h
  - low: 72h
- Added escalation detection for overdue active requests and urgent open requests.
- Added resident support SLA pills and timeline guidance.
- Added admin queue SLA badges, escalation flags, target response timestamps, and explanatory panels.
- Added one-click `Start review` action using the existing support request status mutation.

## Before / After Behavior

Before:

- Residents saw a generic request timeline without SLA context.
- Admins saw priority/status but had to infer urgency manually.
- Overdue or urgent complaints did not stand out as escalation work.

After:

- Residents see whether a request is due soon, overdue, completed, or waiting on them.
- Admins see SLA state beside every support request.
- Escalated complaints are visibly flagged.
- Open complaints can be moved into review with one click.

## Tests Added

- `src/tests/unit/lib/support/complaint-insights.test.ts`

Coverage includes:

- overdue high-priority complaints escalate
- waiting-on-resident requests pause escalation
- priority response-window labels remain stable

## Validation Results

Focused test:

```text
npm run test -- src/tests/unit/lib/support/complaint-insights.test.ts
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
Test Files  126 passed | 3 skipped (129)
Tests       553 passed | 5 skipped (558)
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

- GO for this complaints batch.
- No schema, API, permission, tenant-isolation, or support-service business logic changed.
- Risk is low because SLA/escalation intelligence is derived from existing immutable request fields and existing status mutations.
