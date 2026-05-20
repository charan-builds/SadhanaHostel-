# State Management

## Purpose

Define frontend state ownership across server state, URL state, form state, and local UI state.

## Scope

Applies to:

- Admin filters and tables.
- Resident forms.
- CMS editors.
- Payment state display.
- Notifications UI.

## Responsibilities

Frontend owns:

- Local UI state.
- Form state.
- URL query state.
- Optimistic UI only where approved.

Backend owns:

- Persistent state.
- Business transitions.
- Payment truth.
- Authorization and validation.

## Architecture Overview

```txt
Persistent state: PostgreSQL/Supabase
Server state: Server Components and Server Actions
URL state: search params
Form state: React Hook Form
Local UI state: useState/useReducer
```

## State Categories

| State Type | Tool | Examples |
| --- | --- | --- |
| Server state | Server Components/actions | Resident lists, invoices |
| URL state | Search params | filters, page, sort |
| Form state | React Hook Form | resident form, leave form |
| Local state | React state | dialog open, selected tab |
| Global state | Avoid initially | theme, session display only if needed |

## Rules

- Do not duplicate server truth in global client stores.
- Use URL search params for shareable filters.
- Revalidate after mutations.
- Avoid optimistic updates for payments.
- Keep payment status from backend/webhook only.

## TODO Placeholders

- TODO: Define URL param names for admin tables.
- TODO: Define reusable filter state helpers.
- TODO: Define optimistic UI policy per module.
- TODO: Add server action result type.

## Future Scalability Notes

- Add TanStack Query only if client-heavy server-state needs emerge.
- Add lightweight global store only for cross-route UI state.
- Add realtime subscriptions for notifications after base workflows stabilize.

