# Phase 3 API Migration Report

Date: 2026-06-07

Scope: `PHASE_3_API_MIGRATION`

Allowed:

- `src/app/api/**/route.ts`

Forbidden:

- UI
- components
- layouts
- providers
- pages
- styling

## Summary

The Phase 3 API routes are present and validated.

Implemented endpoints:

- `POST /api/notices/[id]/read`
- `POST /api/notices/[id]/acknowledge`
- `POST /api/notifications/[id]/archive`
- `POST /api/notifications/push-subscriptions`
- `POST /api/notifications/push-subscriptions/revoke`

No UI, component, layout, provider, page, or styling files were modified during this phase.

Note: these route files were already present on the current safety branch from the `ui-recovery` delta, so this phase verified and reported them rather than changing source code.

## Route Handler Convention

Checked current Next route-handler guidance from:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`

Relevant compatibility:

- Route handlers live in `app/api/**/route.ts`.
- Supported HTTP method exports include `POST`.
- Route handlers use Web `Request` / `Response` APIs.
- Dynamic route params can be awaited from the route context.
- Non-GET route handlers are not cached by default; each file also exports `dynamic = "force-dynamic"`.

## API Files

### Notice Read

File:

- `src/app/api/notices/[id]/read/route.ts`

Endpoint:

- `POST /api/notices/[id]/read`

Route behavior:

- Parses JSON body with `parseJsonBody(request)`.
- Awaits dynamic route param `id`.
- Delegates to `NoticesService.markNoticeRead(id, payload)`.
- Returns structured success response: `Notice marked read.`

Authorization:

- `NoticesService.markNoticeRead` calls `AuthService.getCurrentContext()`.
- Requires organization access through `requireOrganizationAccess(context, organizationId)`.
- Requires the current user to have a resident profile for the requested organization.

Tenant isolation:

- Input requires `organizationId`.
- Notice lookup is scoped by `noticeId` and `organizationId`.
- Notification read update is scoped by `noticeId`, `organizationId`, and `recipientUserId`.
- Notice read upsert writes organization, hostel, resident, and user identifiers.

Input validation:

- `markNoticeReadSchema` requires a valid UUID `organizationId`.

Error handling:

- Invalid JSON returns `BAD_REQUEST`.
- Invalid payload returns `VALIDATION_ERROR`.
- Missing resident profile returns `FORBIDDEN`.
- Missing notice returns `NOT_FOUND`.
- Repository failures are converted through `errorResponse(...)`.

### Notice Acknowledgement

File:

- `src/app/api/notices/[id]/acknowledge/route.ts`

Endpoint:

- `POST /api/notices/[id]/acknowledge`

Route behavior:

- Parses JSON body with `parseJsonBody(request)`.
- Awaits dynamic route param `id`.
- Delegates to `NoticesService.acknowledgeNotice(id, payload)`.
- Returns structured success response: `Notice acknowledged.`

Authorization:

- `NoticesService.acknowledgeNotice` calls `AuthService.getCurrentContext()`.
- Requires organization access through `requireOrganizationAccess(context, organizationId)`.
- Requires the current user to have a resident profile for the requested organization.

Tenant isolation:

- Input requires `organizationId`.
- Notice lookup is scoped by `noticeId` and `organizationId`.
- Notification read update is scoped by `noticeId`, `organizationId`, and `recipientUserId`.
- Notice read and acknowledgement upserts write organization, hostel, resident, and user identifiers.

Input validation:

- `acknowledgeNoticeSchema` requires a valid UUID `organizationId`.
- Service rejects acknowledgements for notices that do not require acknowledgement.

Error handling:

- Invalid JSON returns `BAD_REQUEST`.
- Invalid payload returns `VALIDATION_ERROR`.
- Missing resident profile returns `FORBIDDEN`.
- Missing notice returns `NOT_FOUND`.
- Non-acknowledgement notice returns `BAD_REQUEST`.
- Repository failures are converted through `errorResponse(...)`.

### Notification Archive

File:

- `src/app/api/notifications/[id]/archive/route.ts`

Endpoint:

- `POST /api/notifications/[id]/archive`

Route behavior:

- Parses JSON body with `parseJsonBody(request)`.
- Awaits dynamic route param `id`.
- Delegates to `NotificationService.archive(id, payload)`.
- Returns structured success response: `Notification archived.`

Authorization:

- `NotificationService.archive` calls `AuthService.getCurrentContext()`.
- Requires organization access through `requireOrganizationAccess(context, organizationId)`.

Tenant isolation:

- Input requires `organizationId`.
- Archive update is scoped by:
  - notification id
  - organization id
  - current user's `recipient_user_id`
  - `deleted_at is null`
- A user cannot archive another recipient's notification through this API path.

Input validation:

- `archiveNotificationSchema` requires a valid UUID `organizationId`.

Error handling:

- Invalid JSON returns `BAD_REQUEST`.
- Invalid payload returns `VALIDATION_ERROR`.
- Auth and permission errors flow through `errorResponse(...)`.
- Repository failures are converted through `errorResponse(...)`.

### Push Subscription Create / Update

File:

- `src/app/api/notifications/push-subscriptions/route.ts`

Endpoint:

- `POST /api/notifications/push-subscriptions`

Route behavior:

- Parses JSON body with `parseJsonBody(request)`.
- Delegates to `PushSubscriptionsService.subscribe(payload)`.
- Returns structured success response: `Push subscription saved.`

Authorization:

- `PushSubscriptionsService.subscribe` calls `AuthService.getCurrentContext()`.
- Requires organization access through `requireOrganizationAccess(context, organizationId)`.

Tenant isolation:

- Input requires `organizationId`.
- Resident linkage is loaded by current user id and organization id.
- Hostel scope is resolved from resident hostel, requested hostel, or current context.
- Saved subscription writes the current user's `user_id`, resident id when available, organization id, and hostel id.
- Database RLS also requires self insert and organization membership.

Input validation:

- `subscribePushSchema` requires:
  - valid UUID `organizationId`
  - optional valid UUID `hostelId`
  - valid browser push endpoint URL
  - `p256dh` key length 20-512
  - `auth` key length 10-256
  - optional bounded `userAgent`, `platform`, and `deviceLabel`

Error handling:

- Invalid JSON returns `BAD_REQUEST`.
- Invalid payload returns `VALIDATION_ERROR`.
- Auth and permission errors flow through `errorResponse(...)`.
- Repository failures are converted through `errorResponse(...)`.

### Push Subscription Revoke

File:

- `src/app/api/notifications/push-subscriptions/revoke/route.ts`

Endpoint:

- `POST /api/notifications/push-subscriptions/revoke`

Route behavior:

- Parses JSON body with `parseJsonBody(request)`.
- Delegates to `PushSubscriptionsService.revoke(payload)`.
- Returns structured success response: `Push subscription revoked.`

Authorization:

- `PushSubscriptionsService.revoke` calls `AuthService.getCurrentContext()`.
- Revocation is scoped to the current authenticated user.

Tenant isolation:

- Repository update is scoped by `user_id = current user id`.
- Optional endpoint narrows revocation to one browser endpoint.
- A user cannot revoke another user's subscription through this API path.

Input validation:

- `revokePushSubscriptionSchema` accepts optional valid endpoint URL.

Error handling:

- Invalid JSON returns `BAD_REQUEST`.
- Invalid payload returns `VALIDATION_ERROR`.
- Auth errors flow through `errorResponse(...)`.
- Repository failures are converted through `errorResponse(...)`.

## Shared API Safety

All five routes use:

- `withApiRoute(...)`
- `parseJsonBody(...)`
- `successResponse(...)`

`withApiRoute(...)` provides:

- same-origin mutation protection through `assertSameOriginMutation(request)`
- request id generation and response header propagation
- request start/end logging
- request/error metrics
- structured error handling through `errorResponse(...)`

`parseJsonBody(...)` provides:

- invalid JSON rejection
- non-object body rejection

`errorResponse(...)` provides:

- Zod validation errors as `VALIDATION_ERROR`
- app auth/permission errors as structured API failures
- repository guard errors mapped to API errors
- internal errors hidden in production

## Validation Results

### Route File Delta

Command:

```bash
git diff --name-status origin/main..HEAD -- \
  'src/app/api/notices/[id]/read/route.ts' \
  'src/app/api/notices/[id]/acknowledge/route.ts' \
  'src/app/api/notifications/[id]/archive/route.ts' \
  src/app/api/notifications/push-subscriptions/route.ts \
  src/app/api/notifications/push-subscriptions/revoke/route.ts
```

Result:

```text
A src/app/api/notices/[id]/acknowledge/route.ts
A src/app/api/notices/[id]/read/route.ts
A src/app/api/notifications/[id]/archive/route.ts
A src/app/api/notifications/push-subscriptions/revoke/route.ts
A src/app/api/notifications/push-subscriptions/route.ts
```

### Lint

Command:

```bash
npm run lint
```

Result: PASS.

### Typecheck

Command:

```bash
npm run typecheck
```

Result: PASS.

### Security Tests

Command:

```bash
npm run test:security
```

Result: PASS.

Summary:

```text
Test Files  7 passed | 2 skipped (9)
Tests       69 passed | 3 skipped (72)
```

## Files Changed During This Phase

Source files:

- No source files were modified during this phase.
- The five API routes were already present on the current safety branch.

Report file added:

- `PHASE_3_API_REPORT.md`

## Out Of Scope For This Phase

Not touched:

- components
- layouts
- providers
- pages
- styling
- resident dashboard UI
- resident finance UI
- public UI
- notification bell UI
- tests
- background jobs
- DR tooling

## GO / NO-GO

GO for Phase 3 API migration validation.

Reason:

- All five requested API routes are present.
- Authorization is enforced through services.
- Tenant isolation is enforced through organization/current-user scoping plus RLS-backed repositories.
- Input validation is enforced through route JSON parsing and service Zod schemas.
- Error handling uses the shared API wrapper and structured error responses.
- Lint, typecheck, and security tests pass.

NO-GO for production promotion until:

- API behavior is covered by migrated unit/integration tests in the tests phase.
- Out-of-phase UI/provider/page changes inherited from `ui-recovery` are excluded from the clean production branch.
