# Scaling Strategy

## Purpose

Define the technical and product scaling strategy from a single hostel deployment to a multi-hostel SaaS platform.

## Overview

The platform must start simple but avoid decisions that block future growth. The primary scaling concerns are tenant isolation, database performance, background jobs, media storage, payment reliability, reporting, and operational support.

## Scaling Stages

| Stage | Description | Architecture Focus |
| --- | --- | --- |
| Stage 1 | Single hostel | Clean schema, core workflows |
| Stage 2 | Multiple hostels under one owner | `hostel_id`, owner dashboards |
| Stage 3 | Multi-tenant SaaS | `organization_id`, subscriptions, tenant isolation |
| Stage 4 | High-volume operations | background jobs, analytics, partitioning |

## Multi-Tenant Strategy

Use shared database with tenant isolation:

```txt
organizations
  -> hostels
    -> residents
    -> rooms
    -> payments
    -> leaves
    -> notices
```

Every tenant-owned table should include:

- `organization_id`
- `hostel_id` when branch-specific
- RLS policy using membership scope

## Database Scaling

Early-stage:

- Proper indexes.
- Pagination.
- RLS tested for performance.
- Avoid unbounded queries.

Growth-stage:

- Materialized views for dashboards.
- Read-optimized reporting tables.
- Partition audit logs and notifications if needed.
- Archive old records.

## Indexing Priorities

Index columns used for:

- `organization_id`
- `hostel_id`
- `resident_id`
- `status`
- date ranges
- provider references
- invoice numbers
- admission numbers

## Caching Strategy

| Area | Strategy |
| --- | --- |
| Public website | Cache and revalidate after CMS publish |
| CMS pages | Tag-based revalidation |
| Admin lists | No broad caching, use pagination |
| Dashboard aggregates | Short-lived cache or materialized view later |
| Resident data | Dynamic, RLS-protected |
| Media | CDN and optimized image sizes |

## Background Jobs

Candidates for async jobs:

- Monthly fee generation.
- Invoice PDF generation.
- Notification sends.
- Payment reconciliation sync.
- Report generation.
- Backup exports.
- CMS revalidation.

Initial implementation can use admin-triggered server actions. Later, use scheduled jobs or queue infrastructure.

## Performance Targets

| Area | Target |
| --- | --- |
| Public pages | Fast static or cached responses |
| Admin list pages | Under 2 seconds with filters |
| Resident dashboard | Under 2 seconds |
| Payment webhook processing | Idempotent and fast |
| Invoice generation | Async if PDF generation is slow |

## Monitoring for Scale

Track:

- Slow queries.
- Table growth.
- Storage growth.
- Payment webhook latency.
- Notification failure rate.
- Vercel function duration.
- Supabase connection usage.

## SaaS Feature Readiness

Future SaaS needs:

- Tenant onboarding.
- Organization billing.
- Per-tenant limits.
- Custom domains.
- Theme customization.
- Support access controls.
- Data export per tenant.

## TODO Placeholders

- TODO: Confirm tenant model before schema creation.
- TODO: Define organization subscription fields.
- TODO: Define reporting data model.
- TODO: Define queue provider when async jobs are needed.
- TODO: Define tenant limits.
- TODO: Define archival policy.
- TODO: Define performance budgets.

## Future Expansion Notes

- Add dedicated analytics database if reporting grows.
- Add read replicas if query volume requires it.
- Add search service if resident/CMS search becomes advanced.
- Add event-driven architecture for major business events.
- Add per-organization feature flags.

