# Loading and Error States

## Purpose

Define consistent loading, empty, error, permission, and retry states across the frontend.

## Scope

Applies to:

- Public pages.
- Admin dashboard.
- Resident portal.
- Forms.
- Tables.
- Payment workflows.
- File upload workflows.

## Responsibilities

Frontend owns:

- Skeletons.
- Empty states.
- Error display.
- Retry controls.

Backend owns:

- Typed error codes.
- Reliable status responses.
- Observability for server failures.

## Architecture Overview

```txt
Route loading.tsx
  -> page skeleton
Component pending state
  -> action-level feedback
Typed API error
  -> mapped UI message
Error boundary
  -> recoverable route failure
```

## State Types

| State | UI Requirement |
| --- | --- |
| Initial loading | Skeleton preserving layout |
| Empty | Helpful next action |
| Validation error | Field-level details |
| Permission error | Clear access message |
| Network/server error | Retry option |
| Payment pending | Non-final processing state |
| Upload progress | Progress indication |

## Payment Pending Rule

Never show payment success until backend confirms success through provider-confirmed status.

## TODO Placeholders

- TODO: Add route group loading files.
- TODO: Add route group error boundaries.
- TODO: Define reusable EmptyState component.
- TODO: Define API error-to-message map.
- TODO: Define payment polling UI.

## Future Scalability Notes

- Add global incident banner if backend degraded.
- Add support reference IDs for server errors.
- Add retry queues for failed notification actions.

