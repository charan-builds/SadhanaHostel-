# OpenAPI Roadmap

## Purpose

Prepare the API documentation system for machine-readable contracts without blocking current development.

## Target Artifacts

- `docs/api/openapi.json`
- Swagger UI in staging only
- Generated TypeScript API client
- Contract tests for request/response schemas

## Metadata Needed Per Route

| Field | Required |
| --- | --- |
| Method and path | Yes |
| Auth roles | Yes |
| Rate limit policy | For write endpoints |
| Request schema | Yes |
| Response schema | Yes |
| Error codes | Yes |

## TODO

- Add route metadata registry.
- Generate OpenAPI from Zod schemas.
- Add CI check for stale OpenAPI artifacts.
