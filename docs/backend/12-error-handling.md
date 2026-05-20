# Error Handling

## Purpose

Define backend error handling strategy, typed error codes, logging boundaries, and frontend-safe responses.

## Scope

Applies to:

- Server actions.
- Route handlers.
- Domain services.
- Webhooks.
- Background jobs.
- Database operations.

## Responsibilities

Backend owns:

- Error classification.
- Safe response messages.
- Logging internal details.
- Mapping provider errors.

Frontend owns:

- Displaying error messages from contract.

## Architecture Overview

```txt
Domain error
  -> typed application error
  -> log with context
  -> safe API response
  -> frontend maps to UI state
```

## Error Codes

| Code | Meaning |
| --- | --- |
| `UNAUTHENTICATED` | User is not logged in |
| `FORBIDDEN` | User lacks permission |
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Record not found in allowed scope |
| `CONFLICT` | Invalid state transition or duplicate |
| `PAYMENT_PROVIDER_ERROR` | Cashfree/provider issue |
| `UPLOAD_ERROR` | Storage operation failed |
| `INTERNAL_ERROR` | Unexpected failure |

## Logging Rules

- Log internal error details server-side.
- Never return secrets or stack traces to client.
- Include request or correlation ID later.
- Log provider references for payment debugging.

## TODO Placeholders

- TODO: Implement AppError class.
- TODO: Define error response helper.
- TODO: Define provider error mappings.
- TODO: Add correlation IDs.
- TODO: Add frontend error map.

## Future Scalability Notes

- Add centralized log aggregation.
- Add user-facing support reference IDs.
- Add error budget tracking.

