# Supabase Architecture

## Purpose

Define how Supabase will be used for database, authentication, storage, realtime, RLS, and generated types.

## Scope

Covers:

- Supabase Auth.
- PostgreSQL.
- Row Level Security.
- Storage.
- Realtime.
- Edge functions, optional later.
- Local and production environment strategy.

## Responsibilities

Backend owns:

- Supabase project configuration.
- Migrations.
- RLS policies.
- Storage policies.
- Generated database types.

Frontend consumes:

- Server-rendered data and typed contracts.
- Limited browser Supabase client only for approved safe reads or auth interactions.

## Architecture Overview

```txt
Next.js
  -> Supabase SSR client
  -> PostgreSQL with RLS
  -> Auth users
  -> Storage buckets
  -> Realtime subscriptions, later
```

## Supabase Client Strategy

| Client | Location | Purpose |
| --- | --- | --- |
| Browser client | client components only when safe | auth UI, safe realtime |
| Server client | server components/actions | authenticated secure reads/writes |
| Service role client | server-only restricted services | admin jobs, webhooks, migrations |

## RLS Strategy

- Enable RLS on every tenant-owned table.
- Use `auth.uid()` and memberships.
- Public CMS tables expose only published content.
- Storage policies mirror database ownership.

## Storage Strategy

Buckets:

- `resident-documents`
- `invoices`
- `gallery`
- `notice-attachments`

## Realtime Strategy

Use later for:

- Notification badges.
- Payment status updates.
- Leave status updates.

Do not introduce realtime until core workflows are stable.

## Generated Types

Expected workflow:

```bash
supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

TODO: Replace placeholder database type after schema creation.

## TODO Placeholders

- TODO: Install/configure Supabase CLI.
- TODO: Create local Supabase config.
- TODO: Create migrations.
- TODO: Write RLS policies.
- TODO: Define storage buckets.
- TODO: Generate TypeScript types.

## Future Scalability Notes

- Separate staging and production Supabase projects.
- Add tenant onboarding automation.
- Add analytics views.
- Add database branch workflow if Supabase supports desired process.

