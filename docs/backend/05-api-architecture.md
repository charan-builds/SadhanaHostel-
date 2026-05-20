# API Architecture

## Purpose

Define backend API architecture using Next.js route handlers, server actions, domain services, and shared TypeScript contracts.

## Scope

API areas:

- Auth.
- Residents.
- Rooms.
- Payments.
- Leaves.
- Notices.
- Notifications.
- Website CMS.
- Webhooks.

## Responsibilities

Backend owns:

- Endpoint/action implementation.
- Validation.
- Authorization.
- Error mapping.
- Audit logging.

Frontend owns:

- Contract consumption.
- UI state mapping.

## Architecture Overview

```txt
Route Handler / Server Action
  -> validate input
  -> require permission
  -> call domain service
  -> database/provider operation
  -> audit log
  -> typed response
```

## API Boundary Rules

- Server actions are preferred for authenticated form mutations.
- Route handlers are required for webhooks and external callbacks.
- Never place provider secrets in client code.
- All API responses use shared success/error shapes.
- Pagination is mandatory for large collections.

## API Areas

```txt
/api/auth/*
/api/residents/*
/api/rooms/*
/api/payments/*
/api/leaves/*
/api/notices/*
/api/notifications/*
/api/website/*
```

## Pagination Pattern

```ts
type PaginationInput = {
  page: number
  pageSize: number
  sort?: string
  filters?: Record<string, unknown>
}
```

## TODO Placeholders

- TODO: Define server action folder structure.
- TODO: Define route handler folder structure.
- TODO: Define API versioning.
- TODO: Add OpenAPI if external integrations are needed.
- TODO: Define rate limits.

## Future Scalability Notes

- Add generated client from OpenAPI.
- Add request tracing.
- Add queue-backed APIs for long-running tasks.
- Add external partner APIs only after internal contracts stabilize.

