# Analytics Integration Guide

## Purpose

Define frontend consumption patterns for dashboard and advanced analytics APIs.

## APIs

| SDK | Route |
| --- | --- |
| `analyticsSdk.dashboard()` | `/api/v1/analytics/dashboard` |
| `analyticsSdk.advanced()` | `/api/v1/analytics/advanced` |

## Cache Strategy

- Dashboard analytics: short stale time for operational freshness.
- Advanced analytics: longer stale time because trends are heavier aggregations.
- Payment verification and realtime payment events invalidate dashboard keys.

## Usage

```tsx
const analytics = useDashboardAnalytics({ organizationId, hostelId })
```

## Security

- Always pass the current authenticated `organizationId`.
- Do not derive tenant IDs from URL params without session validation.
- Backend RLS and service checks remain authoritative.

## Future Expansion

- Add chart-specific selectors.
- Add server prefetch for first dashboard load.
- Add downloadable analytics snapshots through reports APIs.
