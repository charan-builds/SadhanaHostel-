# Permission Hardening Report

Date: 2026-06-08

## Problem

Admin support and operational alert surfaces were protected by the broad admin shell, but the support service still accepted any admin-portal role for operational alert reads and support request updates.

That meant a role such as `finance`, which should focus on finance workflows, could call support alert APIs or open support queue pages that expose resident operational workflows such as password reset requests, visitor approvals, gate-pass requests, and resident reports.

## Root Cause

The route guard and service layer used different authorization granularity:

- Page shell access checked only admin-portal membership for some general routes.
- `SupportService.getOperationalAlerts(...)` and `SupportService.updateRequest(...)` used `requireRole(ADMIN_PORTAL_ROLES)`.
- `resolveSupportScope(...)` treated every admin-portal role as admin-side support management.
- Admin sidebars queried support alert counts for every admin-portal role, which would create avoidable forbidden API traffic after tightening the service boundary.

## Files Changed

- `src/lib/auth/server-route-guard.ts`
- `src/services/support.service.ts`
- `src/components/admin/layout/admin-sidebar.tsx`
- `src/components/admin/layout/admin-mobile-sidebar.tsx`
- `src/tests/unit/lib/auth/server-route-guard.test.ts`
- `src/tests/unit/services/support.service.test.ts`
- `src/tests/unit/components/permission-hardening-static.test.ts`
- `PERMISSION_HARDENING_REPORT.md`

## Code Implemented

- Added explicit route permission mapping for:
  - `/admin/dashboard` -> `admin.dashboard.view`
  - `/admin/notifications` -> `admin.dashboard.view`
  - `/admin/alerts` -> `residents.manage`
  - `/admin/password-resets` -> `residents.manage`
- Changed `SupportService.updateRequest(...)` to require `residents.manage`.
- Changed `SupportService.getOperationalAlerts(...)` to require `residents.manage`.
- Changed admin-side support scope resolution to use `anyRoleHasPermission(context.roles, "residents.manage")` instead of broad admin-portal role membership.
- Preserved resident-owned support access through the existing resident profile ownership path.
- Gated desktop and mobile admin sidebar support alert polling behind `residents.manage` to avoid finance-only sessions calling forbidden support APIs.

## Tests Added

- Extended `src/tests/unit/lib/auth/server-route-guard.test.ts` for dashboard, notifications, alerts, and password reset route permission mapping.
- Extended `src/tests/unit/services/support.service.test.ts` to verify:
  - owners/admins can read operational alerts through authorized aggregate repositories
  - finance-only users are denied before support alert data is loaded
  - users without `residents.manage` are denied before repository access
  - support updates require `residents.manage` before loading the target support request
- Added `src/tests/unit/components/permission-hardening-static.test.ts` to keep sidebar support polling and support service API guards from regressing.

## Validation Results

Focused permission suite:

```text
npx vitest run src/tests/unit/lib/auth/server-route-guard.test.ts src/tests/unit/services/support.service.test.ts src/tests/unit/lib/rbac-policy.test.ts src/tests/unit/constants/auth-permissions.test.ts src/tests/unit/components/permission-hardening-static.test.ts
Test Files  5 passed (5)
Tests       19 passed (19)
```

Full required gate:

```text
npm run lint
PASS
```

```text
npm run typecheck
PASS
```

```text
npm run test:security
Test Files  8 passed | 2 skipped (10)
Tests       74 passed | 3 skipped (77)
```

```text
npm run test
Test Files  152 passed | 3 skipped (155)
Tests       636 passed | 5 skipped (641)
```

```text
npm run build
PASS
Compiled successfully
Generated static pages using 15 workers (37/37)
```

## Risks

- Risk is low because the change narrows authorization without changing database schema, auth sessions, tenant IDs, payment logic, or resident-owned support access.
- Existing database RLS for support requests remains broader through `can_manage_organization(...)`, but the server service/API path is now stricter for admin-side support workflows.
- A future tenant-isolation pass should review support-request RLS policy granularity if direct browser Supabase access is ever introduced beyond the current service/API model.

## Decision

GO for Permission Hardening batch.
