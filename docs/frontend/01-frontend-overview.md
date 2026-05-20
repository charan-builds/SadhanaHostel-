# Frontend Overview

## Purpose

Define the frontend architecture for the Sadhana Boys Hostel Platform so frontend developers can build independently on `frontend-dev` while staying aligned with backend contracts from `backend-dev`.

## Scope

This document covers the Next.js App Router frontend for:

- Public hostel website.
- Admin ERP dashboard.
- Resident/student portal.
- Shared layouts, UI components, forms, and state patterns.
- Integration boundaries with backend APIs, Supabase server clients, and shared contracts.

## Responsibilities

| Responsibility | Frontend Owns | Backend Owns |
| --- | --- | --- |
| Page composition | Yes | No |
| UI state and interactions | Yes | No |
| Form rendering and client validation | Yes | Shared schemas |
| Business rules | Display only | Yes |
| Database writes | No | Yes |
| API contracts | Consumes | Defines with frontend |
| Auth UI | Yes | Session/RBAC/RLS |

> Warning: Frontend code must never directly manipulate database state from client components. Business mutations must pass through server actions, route handlers, or backend-approved Supabase server helpers.

## Architecture Overview

```txt
Browser
  -> Next.js App Router
    -> Route groups: (public), (admin), (resident)
    -> Server Components for data reads
    -> Client Components for interactions
    -> shadcn/ui components
    -> Backend contract layer
      -> Supabase/PostgreSQL
      -> Cashfree
      -> Notification providers
```

## Frontend Areas

| Area | Route Group | Primary Users | Rendering Strategy |
| --- | --- | --- | --- |
| Public website | `(public)` | Visitors, parents, prospects | Static/CMS revalidated |
| Admin dashboard | `(admin)` | Admin, owner, staff | Authenticated dynamic |
| Resident portal | `(resident)` | Residents/students | Authenticated dynamic |

## Server and Client Component Planning

Use Server Components by default:

- Fetch protected data server-side.
- Keep secrets out of browser bundles.
- Reduce client JavaScript.
- Improve initial page performance.

Use Client Components for:

- Forms with interactive state.
- Dialogs, sheets, tabs, dropdowns.
- Optimistic UI where safe.
- Toasts and local UI state.

## Frontend Branch Rules

- Primary frontend integration branch: `frontend-dev`.
- Feature branches should branch from `frontend-dev`.
- Pull requests into `frontend-dev` must include screenshots for UI changes.
- Any API shape change must update `docs/shared/api-contracts.md`.
- Any enum/status change must update `docs/shared/enums-and-statuses.md`.

## Production Concerns

- Paginate all large tables.
- Use loading and error boundaries for protected areas.
- Keep resident data scoped to the authenticated user.
- Prefer typed route links.
- Validate forms on client and server.
- Design for mobile resident usage.
- Keep admin pages dense but readable.

## TODO Placeholders

- TODO: Add frontend PR template.
- TODO: Define final route-level loading skeletons.
- TODO: Define shared data table component.
- TODO: Define admin dashboard chart library if needed.
- TODO: Add frontend test strategy.

## Future Scalability Notes

- Add organization-aware theming for SaaS tenants.
- Add route-level feature flags.
- Add PWA support for residents.
- Add micro-frontend boundaries only if the product becomes too large for one Next.js app.

