# API Documentation Foundation

## Purpose

This folder documents the internal REST-style API surface for the Sadhana Boys Hostel Platform. It is the contract layer between the Next.js frontend, backend services, repositories, and Supabase.

## API Principles

- API routes call service classes only.
- Services enforce business rules and authorization.
- Repositories own Supabase access.
- Responses use the standard success/error envelopes.
- Every protected request must be traceable by `x-request-id`.
- Financial mutations require audit/payment logging.

## Standard Success Envelope

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully."
}
```

## Standard Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission for this action.",
    "requestId": "req_..."
  }
}
```

## Route Groups

| Area | Prefix | Auth |
| --- | --- | --- |
| Auth | `/api/auth` | Mixed |
| Residents | `/api/residents` | Admin, resident self-access |
| Rooms | `/api/rooms` | Admin/staff |
| Payments | `/api/payments` | Admin, resident self-access |
| Leaves | `/api/leaves` | Admin, resident self-access |
| Notices | `/api/notices` | Organization scoped |
| Website CMS | `/api/website` | Public read, admin write |
| Uploads | `/api/uploads` | Authenticated |

## Future OpenAPI Plan

- Generate `openapi.json` from route metadata.
- Add Swagger UI for staging.
- Export typed API clients for frontend usage.
- Gate internal/admin-only endpoints from public docs.
