# API Versioning Strategy

## Current Version

`/api/v1` is the canonical API surface for new backend capabilities.

## Compatibility Policy

| Change | Version Required |
| --- | --- |
| Add optional request field | No |
| Add response field | No |
| Rename or remove field | Yes |
| Change auth role requirements | Usually yes |
| Change status semantics | Yes |

## Migration Plan

1. Keep existing `/api/*` endpoints active.
2. Add all new modules under `/api/v1/*`.
3. Gradually add v1 aliases for existing modules.
4. Publish OpenAPI contract for frontend integration.
5. Deprecate unversioned APIs after frontend migration.
