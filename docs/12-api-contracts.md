# API Contracts

## Purpose

Define placeholder API contracts for auth, residents, rooms, payments, leaves, notices, notifications, and website CMS.

## Overview

The project may use a combination of Server Actions, Route Handlers, and Supabase direct server calls. Public API-like contracts should still be documented so backend and frontend developers can coordinate on request shapes, response shapes, validation, and error handling.

## API Design Principles

- Validate all inputs with Zod or equivalent schemas.
- Return typed responses.
- Keep provider webhooks in route handlers.
- Use server actions for authenticated form mutations where appropriate.
- Enforce authorization server-side.
- Log critical write operations.
- Use idempotency keys for payment and webhook flows.

## Standard Response Shape

```ts
type ApiSuccess<T> = {
  ok: true
  data: T
  meta?: Record<string, unknown>
}

type ApiError = {
  ok: false
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
  }
}
```

## Auth Contracts

```txt
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
GET  /api/auth/callback
GET  /api/auth/me
```

TODO: Confirm whether these are explicit route handlers or Supabase Auth helper flows.

## Residents Contracts

```txt
GET    /api/residents
POST   /api/residents
GET    /api/residents/:residentId
PATCH  /api/residents/:residentId
POST   /api/residents/:residentId/activate-portal
POST   /api/residents/:residentId/checkout
```

Create resident request placeholder:

```json
{
  "fullName": "Resident Name",
  "phone": "9999999999",
  "guardianName": "Guardian Name",
  "guardianPhone": "9999999999",
  "hostelId": "uuid",
  "roomId": "uuid"
}
```

## Rooms Contracts

```txt
GET   /api/rooms
POST  /api/rooms
GET   /api/rooms/:roomId
PATCH /api/rooms/:roomId
POST  /api/rooms/:roomId/allocate
POST  /api/rooms/:roomId/maintenance
```

## Payments Contracts

```txt
GET  /api/payments
POST /api/payments/offline
POST /api/payments/cashfree/create-order
POST /api/payments/cashfree/webhook
GET  /api/payments/:paymentId
GET  /api/invoices
POST /api/invoices/generate
GET  /api/invoices/:invoiceId/pdf
```

Cashfree order request placeholder:

```json
{
  "invoiceId": "uuid",
  "residentId": "uuid",
  "amount": 10000
}
```

## Leaves Contracts

```txt
GET   /api/leaves
POST  /api/leaves
GET   /api/leaves/:leaveId
POST  /api/leaves/:leaveId/approve
POST  /api/leaves/:leaveId/reject
POST  /api/leaves/:leaveId/mark-departed
POST  /api/leaves/:leaveId/mark-returned
```

Leave request placeholder:

```json
{
  "fromDate": "2026-06-01",
  "toDate": "2026-06-05",
  "reason": "Family function",
  "destination": "Home town"
}
```

## Notices Contracts

```txt
GET   /api/notices
POST  /api/notices
GET   /api/notices/:noticeId
PATCH /api/notices/:noticeId
POST  /api/notices/:noticeId/publish
POST  /api/notices/:noticeId/archive
```

## Notifications Contracts

```txt
GET  /api/notifications
POST /api/notifications/mark-read
POST /api/notifications/test
POST /api/notifications/retry
```

## Website CMS Contracts

```txt
GET   /api/website/pages
POST  /api/website/pages
GET   /api/website/pages/:slug
PATCH /api/website/pages/:pageId
POST  /api/website/pages/:pageId/publish

GET   /api/website/gallery
POST  /api/website/gallery
PATCH /api/website/gallery/:mediaId
DELETE /api/website/gallery/:mediaId

GET   /api/website/settings
PATCH /api/website/settings
```

## Error Codes Placeholder

| Code | Meaning |
| --- | --- |
| `UNAUTHENTICATED` | No valid session |
| `FORBIDDEN` | User lacks permission |
| `VALIDATION_ERROR` | Input failed validation |
| `NOT_FOUND` | Resource not found in allowed scope |
| `CONFLICT` | Duplicate or invalid state transition |
| `PAYMENT_PROVIDER_ERROR` | Cashfree or provider failed |
| `INTERNAL_ERROR` | Unexpected server error |

## Pagination Contract

```json
{
  "page": 1,
  "pageSize": 20,
  "sort": "created_at.desc",
  "filters": {
    "status": "active"
  }
}
```

## TODO Placeholders

- TODO: Decide exact server action vs route handler ownership.
- TODO: Define Zod schemas for all request bodies.
- TODO: Define OpenAPI file if external API consumers are expected.
- TODO: Define webhook signature verification contract.
- TODO: Define rate limits.
- TODO: Define API versioning strategy.

## Future Expansion Notes

- Add API version prefix for external integrations.
- Add generated TypeScript client.
- Add OpenAPI documentation.
- Add background job endpoints for scheduled tasks.
- Add admin export APIs.

