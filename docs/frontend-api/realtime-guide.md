# Realtime Guide

## Purpose

Explain tenant-safe Supabase Realtime subscriptions for dashboard updates.

## Channel Strategy

```text
tenant:<organizationId>:global
tenant:<organizationId>:hostel:<hostelId>
```

Frontend code must never subscribe to a tenant channel unless the authenticated session belongs to that organization.

Payment, leave, and notification hooks subscribe to the hostel-scoped channel when `defaultHostelId` is present:

```text
tenant:<organizationId>:hostel:<hostelId>
```

This must match backend publishers such as `paymentStatusChanged()` and `leaveStatusChanged()` so cache invalidation events are not missed.

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
