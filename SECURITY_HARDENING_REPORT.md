# Security Hardening Report

Date: 2026-06-08

Branch: `backend-feature-migration`

Mode: implementation for Prompt 15 - Security Hardening.

## Summary

Implemented rate-limit protection for sensitive admin and credential-related mutation routes.

No authentication, authorization, database schema, tenant-isolation model, or business logic was changed.

## Problem Found

Several sensitive state-changing endpoints relied on authorization and CSRF/origin checks but did not have route-level rate limits:

- staff access create/update/revoke
- staff temporary password reset
- resident invite create/resend/revoke
- support-request resident password-reset approval
- notification mark-read and mark-all-read mutations

## Root Cause

The central API wrapper already supports rate limits, and policies existed for several public and resident workflows, but these admin mutation surfaces had not been assigned policies.

## Files Changed

- `src/lib/rate-limit/rate-limit.ts`
- `src/app/api/staff-access/users/route.ts`
- `src/app/api/staff-access/users/[id]/route.ts`
- `src/app/api/staff-access/users/[id]/revoke/route.ts`
- `src/app/api/staff-access/users/[id]/reset-password/route.ts`
- `src/app/api/resident-invites/route.ts`
- `src/app/api/resident-invites/[id]/resend/route.ts`
- `src/app/api/resident-invites/[id]/revoke/route.ts`
- `src/app/api/support/requests/[id]/resident-password-reset/route.ts`
- `src/app/api/notifications/[id]/read/route.ts`
- `src/app/api/notifications/read-all/route.ts`
- `src/tests/security/admin-mutation-rate-limit-static.test.ts`
- `SECURITY_HARDENING_REPORT.md`
- `MASTER_PRODUCT_EVOLUTION_REPORT.md`

## Code Implemented

- Added `RATE_LIMIT_POLICIES.staffAccessWrite`.
- Added `RATE_LIMIT_POLICIES.credentialIssuance`.
- Applied staff-access write rate limits to staff create/update/revoke.
- Applied credential-issuance rate limits to staff temporary password reset, resident invite create/resend, and support-request password-reset approval.
- Applied staff-access write rate limit to resident invite revoke.
- Applied notification state-write rate limits to mark-read and mark-all-read routes.
- Preserved all existing authorization checks inside services.

## Tests Added

- `src/tests/security/admin-mutation-rate-limit-static.test.ts`

Coverage includes:

- dedicated staff-access and credential-issuance policies exist
- staff access and credential issuance routes use rate limits
- notification read-state routes use the existing notification state-write rate limit

## Validation Results

Focused security test:

```text
npm run test:security -- src/tests/security/admin-mutation-rate-limit-static.test.ts
Test Files  8 passed | 2 skipped (10)
Tests       72 passed | 3 skipped (75)
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
Test Files  136 passed | 3 skipped (139)
Tests       575 passed | 5 skipped (580)
```

```text
npm run test:security
Test Files  8 passed | 2 skipped (10)
Tests       72 passed | 3 skipped (75)
```

```text
npm run build
PASS
Compiled successfully
Generated static pages using 15 workers (37/37)
```

## Risk Assessment

- GO for Prompt 15.
- Risk is low because the implementation only adds throttling to existing protected mutations.
- Production-grade shared rate limiting still depends on production Redis/shared backing-store credentials and smoke evidence.
