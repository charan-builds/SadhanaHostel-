# Dashboard Integration Guide

## Purpose

Define how dashboard screens consume backend APIs using the frontend SDK and TanStack Query hooks.

## Data Flow

```text
Page/component
-> useDashboardAnalytics/useResidents/usePayments
-> SDK module
-> centralized API client
-> backend route
```

## Query Key Rules

- Every tenant-owned query must include `organizationId`.
- Include `hostelId` when the data is hostel scoped.
- Mutations must invalidate affected tenant query groups.

## Core Hooks

| Hook | Backend |
| --- | --- |
| `useDashboardAnalytics()` | `/api/v1/analytics/dashboard` |
| `useResidents()` | `/api/residents` |
| `useRooms()` | `/api/rooms` |
| `usePayments()` | `/api/payments` |
| `useLeaves()` | `/api/leaves` |
| `useNotices()` | `/api/notices` |
| `useSearch()` | `/api/v1/search` |

## Error Handling

Use `APIErrorState`, `RetryState`, and request IDs from `FrontendApiError` for support-friendly failures.

## Future Expansion

- Add dashboard prefetching in server layouts.
- Add optimistic row-level updates for resident/room forms.
- Add background refresh for finance widgets.
