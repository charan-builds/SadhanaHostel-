# Environment Strategy

## Purpose

Define how staging and production environments are separated for a multi-tenant Hostel SaaS backend.

## Variables

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Project-specific Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Browser-safe anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Server/job only |
| `LOG_LEVEL` | Server | `info` in production |
| `RATE_LIMIT_ENABLED` | Server | Must be `true` in production |
| `NOTIFICATIONS_SEND_ENABLED` | Server | Enable only after provider credentials are configured |

## Tenant Safety

- Every environment must use a separate Supabase project.
- Never share production buckets with staging.
- Analytics caches must include `organizationId` in the key.
- Background jobs must include organization-scoped payloads.
