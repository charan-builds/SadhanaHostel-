# System Architecture

## Purpose

Describe the technical architecture of the Sadhana Boys Hostel Platform, including frontend, backend services, data storage, integrations, caching, security boundaries, and future SaaS scalability.

## Overview

The platform uses a modern full-stack architecture centered on Next.js App Router, Supabase, PostgreSQL, and Vercel. Next.js provides public pages, admin dashboard, resident portal, server actions, route handlers, and UI composition. Supabase provides authentication, database, storage, RLS policies, realtime capabilities, and server-side API access.

## High-Level Architecture

```txt
Users
  |
  | Browser / Mobile Web
  v
Next.js App Router on Vercel
  |-- Public Website
  |-- Admin ERP Dashboard
  |-- Resident Portal
  |-- Server Actions
  |-- Route Handlers
  |
  | Supabase JS / SSR Clients
  v
Supabase
  |-- Auth
  |-- PostgreSQL
  |-- Storage
  |-- Realtime
  |-- Edge Functions, optional later
  |
  v
External Services
  |-- Cashfree Payments
  |-- Email/SMS/WhatsApp Providers
  |-- Monitoring and Logging Tools
```

## Application Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routing | `src/app` | Public, admin, resident route groups |
| UI components | `src/components` | shadcn/ui primitives, layouts, shared views |
| Domain services | `src/services` | Supabase clients, payment adapters, notification adapters |
| Shared logic | `src/lib` | Utilities, env validation, formatting, guards |
| Data constants | `src/constants`, `src/data` | Navigation, static config, seed-like placeholders |
| Types | `src/types` | Shared TypeScript types and generated DB types |
| Documentation | `docs` | Architecture and implementation guidance |

## Route Group Strategy

```txt
src/app
├── (public)
│   ├── page.tsx
│   ├── about
│   ├── rooms
│   ├── facilities
│   ├── gallery
│   ├── contact
│   └── terms
├── (admin)
│   └── admin
│       ├── dashboard
│       ├── residents
│       ├── payments
│       ├── rooms
│       ├── leaves
│       ├── website
│       ├── notifications
│       └── settings
└── (resident)
    └── resident
        ├── dashboard
        ├── profile
        ├── payments
        ├── leave
        └── notices
```

Route groups keep layouts and feature areas organized without leaking group names into URLs.

## Backend Strategy

The platform should avoid a separate backend until business complexity requires it. Initial backend capability can be implemented through:

- Supabase PostgreSQL functions for data integrity where needed.
- Supabase RLS policies for authorization.
- Next.js Server Components for secure reads.
- Next.js Server Actions for mutations.
- Next.js Route Handlers for webhooks and provider callbacks.

## Data Flow Patterns

### Server Read Flow

```txt
Server Component
  -> createSupabaseServerClient()
  -> RLS-protected SQL query
  -> Typed response
  -> Render UI
```

### Mutation Flow

```txt
Client form
  -> Server Action
  -> Validate with Zod
  -> Supabase service call
  -> Audit log insert
  -> Revalidate route or tag
  -> Return typed result
```

### Payment Callback Flow

```txt
Cashfree webhook
  -> Next.js Route Handler
  -> Verify signature
  -> Idempotency check
  -> Update payment record
  -> Create ledger/audit entry
  -> Trigger notification
```

## Multi-Tenant Architecture Direction

Future SaaS support should be planned from the first database design.

| Concept | Purpose |
| --- | --- |
| `organizations` | SaaS tenant or hostel business owner |
| `hostels` | Individual hostel branch under an organization |
| `users` | Authenticated people with app access |
| `memberships` | User role and access per organization/hostel |
| `organization_id` | Tenant isolation key on tenant-owned tables |
| `hostel_id` | Operational branch key for hostel-specific records |

## Security Boundaries

- Browser clients can use only `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Service role keys must never be exposed to the browser.
- RLS must protect every tenant-owned table.
- Webhooks must validate provider signatures.
- Admin-only actions must validate role and tenant membership.
- Financial mutations must write audit logs.

## Performance Strategy

- Use Server Components for default data fetching.
- Use pagination for residents, payments, leaves, notices, invoices, and logs.
- Use indexes on foreign keys, date filters, status columns, and tenant keys.
- Cache public CMS content carefully with revalidation.
- Optimize public images through Next.js image handling and storage metadata.
- Avoid loading large admin datasets on initial page render.

## Caching Strategy

| Area | Cache Approach | Notes |
| --- | --- | --- |
| Public website | Static rendering plus revalidation | Revalidate after CMS publish |
| Admin dashboard | Mostly dynamic | Use small aggregate queries |
| Resident portal | Dynamic | User-specific data via RLS |
| Gallery media | CDN-backed storage | Use optimized sizes |
| API responses | Tag/path revalidation | Avoid stale financial data |

## Monitoring Strategy

- Track application errors in Vercel logs initially.
- Add structured logging around payments, webhooks, auth failures, and invoice generation.
- Add uptime checks for public site and critical portal routes.
- Track query latency for admin list pages.
- Track failed notifications and payment webhook failures.

## Backup and Recovery Strategy

- Use Supabase managed backups for PostgreSQL.
- Define Recovery Point Objective and Recovery Time Objective before launch.
- Export critical financial reports periodically.
- Store invoice files with durable references.
- Test restore procedures before production launch.

## TODO Placeholders

- TODO: Select monitoring provider.
- TODO: Define database tenancy strategy in final schema.
- TODO: Define whether server actions or route handlers own each mutation.
- TODO: Define webhook retry and dead-letter strategy.
- TODO: Define caching tags and revalidation paths.
- TODO: Define storage bucket names and access rules.

## Future Expansion Notes

- Add queue-based background jobs for invoices, reminders, and reports.
- Add analytics warehouse or materialized reporting tables.
- Add regional deployment strategy if user base expands.
- Add feature flags for SaaS modules.
- Add organization billing and subscription enforcement.

