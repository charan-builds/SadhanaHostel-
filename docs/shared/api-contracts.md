# Shared API Contracts

## Purpose

Define the contract layer between frontend and backend teams so `frontend-dev` and `backend-dev` can progress independently and merge cleanly.

## Scope

Covers request/response shapes for:

- Auth.
- Residents.
- Rooms.
- Payments.
- Leaves.
- Notices.
- Notifications.
- Website CMS.
- Uploads.

## Responsibilities

Frontend responsibilities:

- Consume documented contracts only.
- Handle typed success and error responses.
- Keep UI validation aligned with shared validation rules.

Backend responsibilities:

- Implement contracts.
- Enforce authorization and validation.
- Preserve backward compatibility or document breaking changes.

## Architecture Overview

```txt
Frontend UI
  -> shared contract type
  -> server action / route handler
  -> backend service
  -> database/provider
  -> shared response type
  -> frontend UI state
```

## Standard Response Contract

```ts
export type ApiSuccess<T> = {
  ok: true
  data: T
  meta?: {
    requestId?: string
    page?: number
    pageSize?: number
    total?: number
  }
}

export type ApiFailure = {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
    fieldErrors?: Record<string, string[]>
    requestId?: string
  }
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure
```

## Endpoint Placeholders

| Domain | Endpoint | Method | Notes |
| --- | --- | --- | --- |
| Auth | `/api/auth/me` | GET | Current user context |
| Residents | `/api/residents` | GET/POST | Paginated list and create |
| Rooms | `/api/rooms` | GET/POST | Inventory |
| Payments | `/api/payments/offline` | POST | Admin-only offline payment |
| Payments | `/api/payments/cashfree/create-order` | POST | Resident/admin payment start |
| Payments | `/api/payments/cashfree/webhook` | POST | Cashfree callback |
| Leaves | `/api/leaves` | GET/POST | List and create leave |
| Notices | `/api/notices` | GET/POST | Admin notice management |
| Notifications | `/api/notifications` | GET | User notifications |
| Website | `/api/website/pages` | GET/POST | CMS pages |
| Uploads | `/api/uploads/signed-url` | POST | Secure uploads |

## Pagination Contract

```ts
export type PaginatedRequest<TFilters = Record<string, unknown>> = {
  page: number
  pageSize: number
  sort?: string
  filters?: TFilters
}

export type PaginatedResponse<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}
```

## Payment Order Request

```ts
export type CreatePaymentOrderRequest = {
  invoiceId: string
  residentId: string
  amount: number
}
```

## Leave Request

```ts
export type CreateLeaveRequest = {
  fromDate: string
  toDate: string
  reason: string
  destination?: string
}
```

## Contract Change Rules

- Additive changes are preferred.
- Breaking changes require PR notes and updates to frontend/backend docs.
- Enum changes must update `enums-and-statuses.md`.
- Validation changes must update `validation-rules.md`.
- Environment changes must update `environment-variables.md`.

## TODO Placeholders

- TODO: Move stable contracts into `src/types` during implementation.
- TODO: Add OpenAPI if external consumers are introduced.
- TODO: Define server action contracts separately if needed.
- TODO: Define request ID behavior.

## Future Scalability Notes

- Add versioned APIs for public/external integrations.
- Generate typed API clients from contracts.
- Add compatibility tests between frontend and backend branches.

