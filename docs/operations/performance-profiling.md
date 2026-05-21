# Performance Profiling

## Purpose

Define launch performance budgets, profiling workflows, and bottleneck detection for the hostel ERP platform.

## Performance Budgets

| Area | Budget | Alert |
| --- | --- | --- |
| Public page TTFB | < 800 ms p95 | > 1200 ms p95 |
| Auth API latency | < 700 ms p95 | > 1200 ms p95 |
| Dashboard analytics | < 1500 ms p95 | > 2500 ms p95 |
| Search API | < 800 ms p95 | > 1500 ms p95 |
| Export first byte | < 3000 ms p95 | > 5000 ms p95 |
| Upload metadata write | < 1000 ms p95 | > 2000 ms p95 |
| Realtime publish | < 500 ms p95 | > 1000 ms p95 |
| Largest client chunk | < 1 MB | > 1.2 MB |
| Total static assets | < 8 MB | > 10 MB |

## Profiling Commands

```bash
npm run build
npm run ci:bundle-budget
npm run load:k6
```

## Slow API Review

For slow endpoints:

1. Check structured logs by `requestId`.
2. Inspect service timing spans.
3. Confirm tenant filter and pagination are present.
4. Check query plan and indexes.
5. Confirm large exports stream instead of buffering.

## Slow Query Review

PostgreSQL checks:

```sql
explain analyze
select *
from public.payments
where organization_id = '<org-id>'
order by created_at desc
limit 50;
```

Review:

- Tenant index usage.
- Sequential scans on tenant tables.
- Missing `organization_id` filters.
- Expensive count queries on large tables.

## Dashboard Rendering Review

- Keep analytics cards server/API-driven and paginated.
- Avoid rendering large resident/payment tables without pagination.
- Avoid broad React Query invalidation across all tenants.
- Ensure realtime invalidates scoped keys only.

## Load Test Exit Criteria

- Error rate <= 1%.
- p95 API latency below route budget.
- No duplicate payment verification or invoice records.
- No room over-allocation under concurrent allocation tests.
- Sentry remains free of new critical issues.

## TODO

- Add production APM dashboards once metrics backend is selected.
- Add pg_stat_statements review process for Supabase.
- Add per-route performance regression budget in CI.
