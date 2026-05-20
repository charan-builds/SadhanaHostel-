# Backend Folder Structure

## Purpose

Define backend-oriented folder structure and code ownership inside the Next.js project.

## Scope

Applies to backend service code, route handlers, server actions, Supabase clients, migrations, and generated types.

## Responsibilities

Backend owns:

- `src/services`.
- server-only helpers.
- API route handlers.
- database types.
- future Supabase migrations.

Frontend consumes:

- exported typed actions/contracts only.

## Architecture Overview

```txt
src/
├── app/api/              # future route handlers
├── services/
│   ├── supabase/
│   ├── payments/
│   ├── notifications/
│   └── invoices/
├── lib/
│   ├── env.ts
│   ├── auth/
│   └── errors/
└── types/
    └── database.ts

supabase/
└── migrations/           # future
```

## Folder Rules

- Server-only code must not be imported into client components.
- Provider integrations belong in services.
- Route handlers should be thin.
- Domain services own business workflows.
- Shared types belong in `src/types` or `docs/shared` before implementation.

## TODO Placeholders

- TODO: Add `src/services/payments`.
- TODO: Add `src/services/invoices`.
- TODO: Add `src/services/notifications`.
- TODO: Add `src/lib/auth`.
- TODO: Add `src/lib/errors`.
- TODO: Add `supabase/migrations`.

## Future Scalability Notes

- Split services into packages only if a monorepo becomes necessary.
- Add background worker folder if jobs move outside Vercel.
- Add generated database type workflow.

