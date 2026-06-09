# Tenant Isolation Signoff

Date: 2026-06-09

## Problem

The PWA push notification pipeline used a service-role Supabase client for subscription maintenance. Subscription reads were tenant-scoped, but follow-up writes updated or revoked rows by `id`, `endpoint`, or `user_id` without also binding the mutation to `organization_id`.

Because service-role clients bypass RLS, every write path must carry application-level tenant scope. The existing flow normally received subscriptions from a tenant-scoped read, but the repository mutation methods themselves did not enforce that invariant.

## Root Cause

- `PushSubscriptionsRepository.update(...)` updated by subscription id only.
- `PushSubscriptionsRepository.revokeEndpoint(...)` revoked by endpoint only.
- `PushSubscriptionsRepository.revokeForUser(...)` revoked by user id only.
- `WebPushService` and logout cleanup called those methods through service-role repositories, so tenant scope depended on caller discipline instead of the repository contract.

## Files Changed

- `src/repositories/push-subscriptions.repository.ts`
- `src/services/pwa/web-push.service.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/auth.service.ts`
- `src/tests/unit/services/push-subscriptions.service.test.ts`
- `src/tests/unit/services/web-push.service.test.ts`
- `src/tests/security/tenant-isolation-static.test.ts`
- `TENANT_ISOLATION_SIGNOFF.md`
- `MASTER_PRODUCT_EVOLUTION_REPORT.md`

## Code Implemented

- Required `organizationId` for push subscription update, user revoke, and endpoint revoke repository methods.
- Added `.eq("organization_id", input.organizationId)` to every push subscription service-role mutation.
- Passed `notification.organization_id` through web-push delivery updates and permanent endpoint revocation.
- Changed push unsubscribe to resolve the authenticated user's current tenant and require organization access before revoking subscriptions.
- Changed logout cleanup to resolve the current auth context and revoke only subscriptions in that tenant.

## Tenant Isolation Checks

- Resident notification delivery status updates are now scoped by subscription id and organization id.
- Permanent web-push endpoint revocation is now scoped by endpoint and organization id.
- User-triggered unsubscribe is now scoped by authenticated user id and organization id.
- Logout cleanup is now tenant-aware instead of user-global.
- No backend business logic, payment logic, schema, authentication, or tenant ID model was changed.

## Tests Added

- Added `PushSubscriptionsService` coverage proving unsubscribe passes `organizationId`, `userId`, endpoint, and actor id to the repository.
- Updated `WebPushService` tests to require tenant-scoped update and revoke calls.
- Added a security static test that locks the service-role push-subscription mutation contract to `organization_id`.

## Validation Results

Focused tenant-isolation suite:

```text
npm run test -- --run src/tests/unit/services/push-subscriptions.service.test.ts src/tests/unit/services/web-push.service.test.ts src/tests/security/tenant-isolation-static.test.ts
Test Files  3 passed (3)
Tests       22 passed (22)
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
npm run test
Test Files  152 passed | 3 skipped (155)
Tests       638 passed | 5 skipped (643)
```

```text
npm run test:security
Test Files  8 passed | 2 skipped (10)
Tests       75 passed | 3 skipped (78)
```

```text
npm run build
PASS
Compiled successfully
Generated static pages using 15 workers (37/37)
```

## Risk Assessment

Risk is low. The change narrows service-role write scope for push subscription maintenance without changing user sessions, database schema, payment logic, public website behavior, or resident/admin business workflows.

Residual risk: repository-level optional tenant parameters still exist for some current-user reads and legacy internal methods. The exposed service paths reviewed in this batch either pass `organizationId` or enforce `requireHostelAccess(...)` after loading the row. A future broader repository-contract cleanup can make those read signatures mandatory if we want compile-time enforcement everywhere.

## Decision

GO for Tenant Isolation Verification batch.
