# OpenAPI and Swagger Architecture

## Purpose

This folder documents the OpenAPI contract strategy for the Sadhana Boys Hostel Platform.

## Current Contract

- Current version prefix: `/api/v1`
- Machine-readable route: `/api/v1/openapi`
- Source file: `src/lib/openapi/openapi-document.ts`

## Auth Model

All protected endpoints use Supabase session cookies. Backend services still enforce RBAC and tenant isolation; OpenAPI only documents required auth, it does not replace service-level authorization.

## Response Envelopes

All API responses continue to use the platform envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully."
}
```

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission for this action.",
    "requestId": "uuid"
  }
}
```

## Swagger Plan

- Serve Swagger UI only in staging or behind admin access.
- Generate schemas from Zod contracts in a later phase.
- Add contract tests that compare route validation schemas with OpenAPI request bodies.

## Versioning Rules

- New external endpoints should be created under `/api/v1`.
- Existing unversioned endpoints remain for backward compatibility during migration.
- Breaking changes require `/api/v2`.
- Non-breaking response additions can remain in `/api/v1`.
