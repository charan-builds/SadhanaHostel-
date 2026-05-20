# Frontend Performance Optimization

## Purpose

Define frontend performance standards and optimization strategies for a production SaaS ERP platform.

## Scope

Applies to:

- Public pages.
- Admin dashboards and tables.
- Resident portal.
- CMS gallery/media.
- Forms and interactions.

## Responsibilities

Frontend owns:

- Component rendering efficiency.
- Image optimization.
- Bundle hygiene.
- Loading skeletons.

Backend owns:

- Efficient queries.
- Pagination.
- Indexes.
- Cache headers and revalidation.

## Architecture Overview

```txt
Server-first rendering
  -> small client components
  -> paginated data
  -> optimized media
  -> measured performance
```

## Optimization Rules

- Use Server Components by default.
- Keep client components small.
- Lazy-load heavy client-only features.
- Optimize and size images.
- Avoid rendering huge lists.
- Use pagination and filters.
- Avoid unnecessary provider wrappers.

## Public Website Performance

- Static render where possible.
- Revalidate after CMS publish.
- Use image dimensions.
- Avoid blocking third-party scripts.

## Admin Performance

- Dashboard aggregates should be optimized.
- Tables must be paginated.
- Search should use indexed fields.
- Avoid client-side filtering of large datasets.

## Monitoring Metrics

| Metric | Target Direction |
| --- | --- |
| LCP | Optimize public pages |
| INP | Keep client JS small |
| CLS | Stable dimensions |
| TTFB | Cache public content |
| Function duration | Optimize server queries |

## TODO Placeholders

- TODO: Add performance budget.
- TODO: Add image handling policy.
- TODO: Add bundle analyzer script if needed.
- TODO: Define dashboard query budget.
- TODO: Define public page Lighthouse target.

## Future Scalability Notes

- Add CDN-backed media transformations.
- Add materialized views for dashboard metrics.
- Add frontend performance monitoring.

