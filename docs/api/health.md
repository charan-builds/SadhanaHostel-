# Health Checks

## Purpose

Document deployment-safe health endpoints used by CI, uptime monitors, and release validation.

## Endpoints

| Method | Path | Purpose | Expected Status |
| --- | --- | --- | --- |
| `GET` | `/api/health/live` | Process liveness only | `200` |
| `GET` | `/api/health/ready` | Dependency readiness | `200` or `503` |

## Readiness Checks

`/api/health/ready` verifies:

- Runtime environment validation
- In-memory cache read/write
- Supabase PostgreSQL connectivity
- Supabase Storage bucket API availability

## Security Rules

- Responses must not expose secrets, DSNs, service-role keys, SQL errors, or tenant data.
- Monitors should alert on sustained `503` responses from `/ready`, not on a single transient failure.
- Deployment smoke tests should call `/live` first, then `/ready`.

## TODO

- Add queue readiness once an external queue is introduced.
- Add regional latency thresholds for production monitoring.
