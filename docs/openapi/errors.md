# OpenAPI Error Responses

## Standard Error Schema

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "requestId": "uuid"
  }
}
```

## Common Error Codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Supabase session missing or invalid |
| `FORBIDDEN` | 403 | Role or tenant access denied |
| `NOT_FOUND` | 404 | Resource not found inside tenant scope |
| `CONFLICT` | 409 | Business invariant conflict |
| `VALIDATION_ERROR` | 422 | Request schema validation failed |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Sanitized server failure |

## Production Rules

- 5xx responses must not expose provider, SQL, storage, or stack details.
- Every error includes `requestId`.
- Logs contain detailed context with sensitive fields redacted.
