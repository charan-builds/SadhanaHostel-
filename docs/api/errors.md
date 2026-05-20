# API Error Codes

## Purpose

Document production-safe error codes returned by API routes.

## Error Shape

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "requestId": "7c8ed2fd-9c4c-4f29-912f-000000000000",
    "details": {}
  }
}
```

## Codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Invalid request shape |
| `UNAUTHORIZED` | 401 | Missing or invalid session |
| `FORBIDDEN` | 403 | Role or tenant access denied |
| `NOT_FOUND` | 404 | Resource not found or inaccessible |
| `CONFLICT` | 409 | Business rule conflict |
| `PAYMENT_IMMUTABLE` | 409 | Attempted mutation of verified financial record |
| `VALIDATION_ERROR` | 422 | Zod validation failure |
| `RATE_LIMITED` | 429 | Request limit exceeded |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

## Operational Policy

- 4xx messages may be exposed to clients.
- 5xx messages are sanitized in production.
- Every error response includes a request ID.
- Logs contain structured metadata with sensitive values redacted.
