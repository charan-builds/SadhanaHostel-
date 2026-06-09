# Monthwise Analytics Implementation Report

Date: 2026-06-08

## Summary

Month-wise historical analysis is now available across the owner analytics, reports, and payments surfaces. The implementation reuses existing analytics and payments APIs, extends the existing owner analytics response with additional real historical metrics, and avoids fake/sample data.

Final status: GO

## Implemented Scope

- Added a shared Month Selector with month labels such as January 2026, February 2026, and March 2026.
- Added quick filters:
  - This Month
  - Last Month
  - Last 3 Months
  - Last 6 Months
  - This Year
  - Custom Range
- Added reusable date range logic in `src/lib/monthwise-analytics.ts`.
- Added reusable UI controls in `src/components/admin/analytics/monthwise-date-range-controls.tsx`.
- Wired the controls into:
  - Owner Dashboard
  - Reports
  - Payments
- Preserved mobile-friendly stacked layouts and existing dashboard behavior.

## Owner Historical Metrics

The Owner Dashboard now includes a Monthwise Historical Analysis panel showing:

- Revenue by month
- Collections by month
- Outstanding dues by month
- Occupancy by month
- Admissions by month
- Complaints by month
- Notice engagement by month
- Resident activity by month

## Real Data Sources

No fake data was added. Metrics are derived from existing platform records:

- Revenue and collections: verified payments using `verified_at`.
- Outstanding dues: monthly fee records using `period_month`.
- Occupancy: room allocation windows and active room capacity.
- Admissions: resident joins plus admission lead inquiries.
- Complaints: support requests and resident report workflows.
- Notice engagement: notice reads and acknowledgements.
- Resident activity: payments, leaves, support requests, notice reads, acknowledgements, resident joins, and resident exits.

## Backend/API Notes

No duplicate monthwise endpoint was added.

Existing APIs were reused:

- `/api/v1/analytics/owner`
- `/api/payments`
- `/api/v1/reports/[type]`
- Existing list routes for notices, residents, support requests, and leaves

The owner analytics service was extended to include the new historical metrics in the existing monthly trend rows.

## Reports

Reports now use the same month/range control and keep the explicit date basis:

- Revenue date
- Activity date

Report previews now use owner range analytics instead of current-only dashboard metrics.

## Payments

Payments now support month/range filtering through the existing payments API.

The payment export includes:

- Selected date range
- Selected date basis
- Created and verified timestamps

## Validation

Focused validation:

- `npx vitest run src/tests/unit/lib/monthwise-analytics.test.ts src/tests/unit/components/monthwise-analytics-static.test.ts src/tests/unit/services/analytics.service.test.ts` - passed, 9 tests.

Full validation:

- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run test` - passed, 145 files passed, 3 skipped; 606 tests passed, 5 skipped.
- `npm run test:security` - passed, 8 files passed, 2 skipped; 73 tests passed, 3 skipped.
- `npm run build` - passed.

## Launch Verdict

GO.

The platform now supports month-wise historical owner visibility across analytics, reports, payments, and occupancy without hardcoded or fake analytics data.
