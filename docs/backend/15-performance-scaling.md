# Backend Performance and Scaling

## Purpose

Define backend performance, query optimization, indexing, caching, and scaling strategies.

## Scope

Applies to:

- PostgreSQL queries.
- Supabase APIs.
- Server actions.
- Route handlers.
- Webhooks.
- Background jobs.

## Responsibilities

Backend owns:

- Query design.
- Indexing.
- Pagination.
- Cache invalidation.
- Job batching.

Frontend owns:

- Requesting paginated data and avoiding over-fetching.

## Architecture Overview

```txt
Tenant-scoped query
  -> indexed filters
  -> paginated result
  -> minimal response shape
  -> frontend render
```

## Query Optimization Rules

- Always filter by `organization_id`.
- Include `hostel_id` when possible.
- Paginate large lists.
- Index status/date filters.
- Avoid selecting unused columns.
- Use aggregate queries carefully.

## Caching

| Data | Strategy |
| --- | --- |
| Public CMS | cache + revalidate |
| Admin dashboard | short-lived or materialized later |
| Financial records | prefer fresh reads |
| Resident portal | dynamic scoped reads |
| Gallery media | CDN/storage cache |

## TODO Placeholders

- TODO: Define query performance budget.
- TODO: Add slow query review process.
- TODO: Define materialized views.
- TODO: Define cache tags.
- TODO: Add load testing plan.

## Future Scalability Notes

- Add read replicas if needed.
- Partition high-volume audit tables.
- Add analytics warehouse.
- Add queue workers for heavy tasks.

