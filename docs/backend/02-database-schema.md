# Database Schema

## Purpose

Define PostgreSQL schema planning for hostel ERP operations, resident portal workflows, CMS, financial records, and SaaS tenant isolation.

## Scope

Covers planned tables, relationships, indexes, constraints, RLS readiness, and migration practices.

## Responsibilities

Backend owns:

- Schema design.
- Migrations.
- Constraints and indexes.
- Generated TypeScript types.
- RLS policies.

Frontend consumes:

- View models and API responses, not raw schema assumptions.

## Architecture Overview

```txt
organizations
  -> hostels
    -> residents
    -> rooms
    -> room_allocations
    -> monthly_fee_records
    -> payments
    -> invoices
    -> leave_requests
    -> notices
    -> notifications
    -> documents
    -> CMS content
```

## Required Tables

| Table | Purpose | Tenant Fields |
| --- | --- | --- |
| `organizations` | SaaS tenant/business | `id` |
| `hostels` | Hostel branches | `organization_id` |
| `users` | App profile linked to auth | tenant through memberships |
| `memberships` | RBAC and scope | `organization_id`, `hostel_id` |
| `residents` | Resident records | `organization_id`, `hostel_id` |
| `rooms` | Room inventory | `organization_id`, `hostel_id` |
| `room_allocations` | Resident room history | `organization_id`, `hostel_id` |
| `payments` | Payment records | `organization_id`, `hostel_id` |
| `monthly_fee_records` | Monthly dues | `organization_id`, `hostel_id` |
| `leave_requests` | Leave workflow | `organization_id`, `hostel_id` |
| `notices` | Published notices | `organization_id`, `hostel_id` optional |
| `notifications` | User notifications | `organization_id` |
| `gallery` | Public media | `organization_id`, `hostel_id` optional |
| `website_settings` | CMS settings | `organization_id`, `hostel_id` optional |
| `invoices` | Billing documents | `organization_id`, `hostel_id` |
| `documents` | Resident files | `organization_id` |
| `audit_logs` | Critical action trail | `organization_id` |

## Indexing Plan

```sql
create index on residents (organization_id, hostel_id, status);
create index on rooms (organization_id, hostel_id, status);
create index on room_allocations (resident_id, status);
create index on monthly_fee_records (organization_id, hostel_id, period_month, status);
create index on payments (organization_id, hostel_id, paid_at desc);
create index on payments (provider_reference);
create index on leave_requests (organization_id, hostel_id, status, from_date);
create index on notices (organization_id, hostel_id, published_at desc);
create index on audit_logs (organization_id, created_at desc);
```

## Constraints

- Unique admission number per hostel.
- Unique room number per hostel.
- Unique invoice number per organization or hostel.
- Payment amount must be positive.
- Allocation active range should not overlap for same bed.

## Migration Checklist

- [ ] Migration file created.
- [ ] RLS impact documented.
- [ ] Indexes included for new query patterns.
- [ ] Type generation updated.
- [ ] Shared docs updated.
- [ ] Backward compatibility considered.

## TODO Placeholders

- TODO: Finalize full SQL migrations.
- TODO: Define enum strategy.
- TODO: Define soft-delete policy.
- TODO: Define archival strategy.
- TODO: Define materialized views for dashboard metrics.

## Future Scalability Notes

- Partition `audit_logs` and notifications at high volume.
- Use materialized views for owner dashboards.
- Add reporting tables for financial summaries.
- Add organization billing tables for SaaS subscriptions.

