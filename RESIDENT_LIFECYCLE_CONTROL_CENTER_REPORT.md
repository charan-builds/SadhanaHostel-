# Resident Lifecycle Control Center Report

Date: 2026-06-09

## Status

Implemented.

## Delivered

- Added lifecycle aggregation engine in `src/lib/residents/lifecycle-control-center.ts`.
- Added service and API at `/api/residents/lifecycle-control-center`.
- Added admin UI at `/admin/residents/lifecycle`.
- Added sidebar and navigation entries.
- Added SDK, React Query hook, validation schema, and query keys.
- Added unit coverage in `src/tests/unit/lib/residents/lifecycle-control-center.test.ts`.

## Lifecycle Stages

- Draft Residents
- Invited Residents
- Profile Incomplete
- Verified Residents
- Active Residents
- Leave Pending
- Leave Approved
- Fee Due
- Advance Covered
- Checkout Pending
- Checked Out

## Color Rules

- Red: fee due and suspended-risk states.
- Yellow: profile incomplete, pending verification, draft/invited, leave pending, checkout pending.
- Green: active, verified, leave approved.
- Blue: advance covered.

## Controls

- Search across resident name, admission number, phone, room, status, and onboarding state.
- Quick filters by stage.
- Month filter for fee and leave period context.
- Room filter for focused occupancy/lifecycle review.

## Resident Health Score

Health score now factors:

- Payment status and dues.
- Profile completion.
- Leave state.
- Overdue dues.
- Suspended status.
- Advance coverage.

Profile-incomplete residents are now classified as attention instead of healthy.

## Verification

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test`: passed
- `npm run test:security`: passed
- `npm run test:smoke`: passed
- `npm run build`: passed
