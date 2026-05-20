# Route Documentation Structure

## Versioned Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/openapi` | OpenAPI JSON contract |
| `GET` | `/api/v1/analytics/dashboard` | Admin dashboard analytics |
| `POST` | `/api/v1/invoices/generate` | Generate immutable invoice PDF |
| `GET` | `/api/v1/invoices/{id}/download` | Generate signed invoice download URL |
| `POST` | `/api/v1/jobs/run` | Admin-triggered registered job execution |

## Route Documentation Template

Each new route should document:

- Method and path
- Auth role requirements
- Tenant boundary fields
- Request schema
- Success response schema
- Error response codes
- Rate limit policy
- Cache behavior
- Audit/metrics events
