# API Integration

## Purpose

Define how the frontend integrates with backend contracts, server actions, route handlers, Supabase SSR reads, and external payment flows.

## Scope

Applies to:

- Public inquiry forms.
- Admin CRUD workflows.
- Resident portal actions.
- Payment initiation and status display.
- CMS publish actions.

## Responsibilities

Frontend developers own:

- Calling documented APIs/actions.
- Rendering states based on response contracts.
- Never bypassing business logic.

Backend developers own:

- Endpoint/action implementation.
- Auth/RBAC checks.
- Database writes.
- Error response contract.

## Architecture Overview

```txt
UI component
  -> typed client action or form action
  -> server action / route handler
  -> validation
  -> service layer
  -> database/provider
  -> typed response
```

## Integration Rules

- Use shared request/response types.
- Validate on client for UX and server for security.
- Treat API errors as typed states.
- Use route handlers for webhooks and provider callbacks.
- Use server actions for authenticated form mutations where suitable.
- Do not call Supabase from browser for privileged mutations.

## Response Handling Pattern

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
```

## Caching and Revalidation

| Workflow | Revalidation |
| --- | --- |
| CMS publish | Revalidate public route/tag |
| Resident update | Revalidate resident profile route |
| Payment update | Revalidate payment/invoice views |
| Notice publish | Revalidate notices list |

## TODO Placeholders

- TODO: Define server action file conventions.
- TODO: Define fetch wrapper if route handlers are used heavily.
- TODO: Define API error toast mapping.
- TODO: Define webhook status polling for payments.
- TODO: Define typed action result helper.

## Future Scalability Notes

- Add generated API client if OpenAPI is introduced.
- Add request tracing IDs for support.
- Add realtime updates for notices/payment status where useful.

