# Backend Overview

## Purpose

Define the backend architecture for the Sadhana Boys Hostel Platform so backend developers can build independently on `backend-dev` while preserving stable contracts for `frontend-dev`.

## Scope

Backend areas:

- Supabase PostgreSQL.
- Supabase Auth.
- Row Level Security.
- Server actions and route handlers.
- Cashfree payment integration.
- Invoice generation.
- Notifications.
- File uploads.
- Background jobs.
- Monitoring, backups, and audit logs.

## Responsibilities

Backend developers own:

- Database schema and migrations.
- Business rules.
- API/server action implementations.
- RLS and RBAC enforcement.
- Webhooks and integrations.
- Audit logs and observability.

Frontend developers own:

- UI, user flows, and typed contract consumption.

> Warning: Backend controls business logic. Frontend must not directly manipulate database records from client components.

## Architecture Overview

```txt
Next.js Server Runtime
  -> Server Actions
  -> Route Handlers
  -> Domain Services
  -> Supabase PostgreSQL/Auth/Storage
  -> External Providers
       -> Cashfree
       -> Notification providers
```

## Backend Branch Rules

- Primary backend integration branch: `backend-dev`.
- Schema/API changes must update `/docs/shared`.
- Database migrations must be reviewed before merge.
- RLS changes require explicit test notes.
- Webhook changes require idempotency notes.

## Core Backend Principles

- PostgreSQL is the source of truth.
- RLS is mandatory for tenant-owned tables.
- Every critical mutation writes an audit log.
- Webhooks are verified and idempotent.
- API errors are typed and stable.
- Tenant isolation uses `organization_id`.
- Hostel-specific operations also use `hostel_id`.

## TODO Placeholders

- TODO: Add Supabase CLI.
- TODO: Create migrations folder.
- TODO: Define domain service folder conventions.
- TODO: Define audit logging utility.
- TODO: Add backend CI checks.

## Future Scalability Notes

- Add queue-based background jobs.
- Add materialized reporting tables.
- Add SaaS tenant onboarding service.
- Add owner-level reporting APIs.

