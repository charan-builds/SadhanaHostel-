# Owner Dashboard Fix Report

Date: June 9, 2026

## Root Cause

### Operations Automation 403

- The page and API reused the broad `settings.manage` capability instead of an explicit automation boundary.
- After route authorization succeeded, the consistency scan called the service-role-only `get_resident_tenant_identity_anomaly_report` RPC through a user-scoped repository. PostgreSQL returned `42501`, surfaced as the reported 403.

### Owner PDF and CSV 401

- The export client was the only analytics request that attached a browser access token manually.
- A stale bearer token could override a valid cookie session in the server Supabase client, while normal API requests continued to work through same-origin cookies.

### Period Controls Did Not Clearly Refresh Data

- React Query keys already included dates, but prominent revenue, overdue, collection pulse, and recent-payment widgets came from the unfiltered finance dashboard.
- The owner analytics response lacked period-scoped occupancy, complaint, notice-engagement, and overdue totals.
- Loading, refreshing, active-period, comparison, and last-updated states were not visible.

## Fixes

- Added `automation.manage` for `super_admin`, `owner`, and `admin`.
- Enforced the capability in the server route guard, automation service, and automation settings RLS.
- Moved post-authorization automation diagnostics to the service-scoped repository while retaining organization and hostel checks.
- Removed manual bearer injection from exports; downloads now use the standard same-origin cookie session.
- Added exact selected-range labels and filenames to PDF and CSV exports.
- Made revenue, billing, dues, overdue amount, collection rate, occupancy, admissions, complaints, notice engagement, resident activity, onboarding, trends, aging, forecasts, and insights period-aware.
- Added previous-period analytics queries for KPI comparisons.
- Removed unfiltered finance-dashboard widgets from the owner analytics page.

## Files Changed

- `src/constants/auth.ts`
- `src/lib/auth/server-route-guard.ts`
- `src/services/operations/automation.service.ts`
- `supabase/migrations/20260609001000_automation_permission_hardening.sql`
- `src/repositories/analytics.repository.ts`
- `src/services/analytics.service.ts`
- `src/sdk/analytics.sdk.ts`
- `src/hooks/use-analytics.ts`
- `src/lib/analytics/owner-period.ts`
- `src/components/admin/analytics/owner-dashboard-client.tsx`
- Owner analytics, SDK, RBAC, automation, migration-security, and period utility tests

## Tests Added

- Owner/admin-only automation permission matrix and route mapping
- Service-scoped automation diagnostic repository regression
- Cookie-authenticated CSV/PDF SDK downloads without an Authorization header
- Exact export range and generated PDF/CSV coverage
- Period occupancy, collection, overdue, admissions, complaints, and notice-engagement calculations
- UTC preset and previous-period range behavior
- Automation RLS migration static security assertion

## Screens Fixed

- `/admin/operations/automation`
- `/admin/owner-dashboard`
- `/api/v1/analytics/owner/export?format=csv`
- `/api/v1/analytics/owner/export?format=pdf`

## Validation Results

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test`: 493 passed, 5 skipped
- `npm run test:security`: 67 passed, 3 skipped
- `npm run build`: passed with Next.js 16.2.6
- Authenticated admin browser check:
  - Automation page permission message count: 0
  - Automation API: 200
  - CSV export: 200, `text/csv`, exact May 1-31 range present
  - PDF export: 200, `application/pdf`, 1,998 bytes
- Anonymous owner analytics and automation smoke checks passed.
- Focused owner analytics smoke spec: 2/2 passed.
- Focused automation authorization/API checks passed; its separate public support-page check encountered external asset `ERR_SSL_PROTOCOL_ERROR` noise during the isolated rerun.
- Full `npm run test:smoke`: 55 passed, 12 skipped, 3 unrelated existing failures:
  - `/rooms` expected heading mismatch
  - `/gallery` expected heading mismatch
  - Anonymous occupancy mutation returned 410 instead of the test's allowed 401/403

The three smoke failures are outside the owner dashboard and automation changes and were left untouched to preserve concurrent resident/public-page work.
