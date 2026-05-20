# Realtime Guide

## Purpose

Explain tenant-safe Supabase Realtime subscriptions for dashboard updates.

## Channel Strategy

```text
tenant:<organizationId>:global
tenant:<organizationId>:hostel:<hostelId>
```

Frontend code must never subscribe to a tenant channel unless the authenticated session belongs to that organization.

## Hooks

| Hook | Event |
| --- | --- |
| `useRealtimeNotifications()` | `notification.created` |
| `useRealtimePayments()` | `payment.status_changed` |
| `useRealtimeLeaves()` | `leave.status_changed` |

## Behavior

Realtime hooks invalidate TanStack Query caches instead of mutating large state trees directly.

## Future Expansion

- Add presence for admin dashboards.
- Add resident-specific private channels.
- Add reconnect telemetry and user-facing offline state.
