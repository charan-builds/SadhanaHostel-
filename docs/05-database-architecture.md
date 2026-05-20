# Database Architecture

## Purpose

Define the PostgreSQL and Supabase data architecture blueprint for residents, rooms, fees, payments, leaves, notices, CMS content, invoices, documents, and future multi-hostel SaaS support.

## Overview

PostgreSQL is the source of truth. Supabase provides managed PostgreSQL, Auth, Storage, Row Level Security, generated TypeScript types, and optional realtime features. The schema must prioritize tenant isolation, financial correctness, auditability, and future reporting.

## Core Design Principles

- Every tenant-owned table should include `organization_id`.
- Hostel-specific tables should include `hostel_id`.
- Financial records should be append-friendly and auditable.
- Payment gateway events should be idempotent.
- Room allocation history should not be overwritten.
- RLS policies should be designed alongside tables, not after launch.
- Soft delete should be considered for critical operational records.

## Proposed Schema Areas

| Area | Tables |
| --- | --- |
| Tenancy | `organizations`, `hostels`, `memberships` |
| Identity | `users`, Supabase `auth.users` |
| Residents | `residents`, `documents` |
| Rooms | `rooms`, `beds`, `room_allocations` |
| Fees and payments | `fee_plans`, `monthly_fee_records`, `payments`, `invoices`, `invoice_line_items` |
| Leave | `leave_requests` |
| Communication | `notices`, `notifications` |
| CMS | `website_settings`, `cms_pages`, `gallery` |
| Audit | `audit_logs`, `webhook_events` |

## Required Database Placeholder Tables

### `organizations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | text | Organization or hostel business name |
| `slug` | text | Unique tenant slug |
| `status` | text | active, suspended, archived |
| `created_at` | timestamptz | Default now |
| `updated_at` | timestamptz | Updated by trigger |

TODO: Define SaaS subscription fields.

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | References Supabase auth user |
| `full_name` | text | Display name |
| `phone` | text | Optional unique per tenant |
| `email` | text | Auth email |
| `status` | text | active, disabled |
| `created_at` | timestamptz | Default now |

TODO: Decide whether profile data lives in `users` or role-specific tables.

### `residents`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Hostel branch |
| `user_id` | uuid | Nullable until portal invited |
| `admission_number` | text | Unique per hostel |
| `full_name` | text | Legal/display name |
| `phone` | text | Resident phone |
| `guardian_name` | text | Guardian details |
| `guardian_phone` | text | Guardian contact |
| `status` | text | draft, active, checked_out, archived |
| `joined_on` | date | Admission date |

### `rooms`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Hostel branch |
| `room_number` | text | Display identifier |
| `floor` | text | Optional |
| `capacity` | integer | Number of beds |
| `monthly_rent` | numeric | Base price |
| `status` | text | active, maintenance, inactive |

### `room_allocations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Hostel branch |
| `resident_id` | uuid | Resident |
| `room_id` | uuid | Room |
| `bed_id` | uuid | Optional |
| `allocated_from` | date | Start date |
| `allocated_to` | date | Null while active |
| `status` | text | active, transferred, completed |

### `monthly_fee_records`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Hostel branch |
| `resident_id` | uuid | Resident |
| `period_month` | date | Use first day of month |
| `base_amount` | numeric | Monthly fee |
| `adjustments` | numeric | Discounts or extra charges |
| `total_amount` | numeric | Final amount |
| `paid_amount` | numeric | Denormalized for quick view |
| `status` | text | pending, partial, paid, overdue, waived |

### `payments`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Hostel branch |
| `resident_id` | uuid | Resident |
| `monthly_fee_record_id` | uuid | Optional link |
| `amount` | numeric | Amount paid |
| `mode` | text | cash, upi, bank, cashfree |
| `provider_reference` | text | Gateway/order/payment reference |
| `status` | text | initiated, success, failed, refunded |
| `paid_at` | timestamptz | Payment timestamp |

### `leave_requests`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Hostel branch |
| `resident_id` | uuid | Resident |
| `from_date` | date | Leave start |
| `to_date` | date | Leave end |
| `reason` | text | Resident entered reason |
| `destination` | text | Optional |
| `status` | text | pending, approved, rejected, departed, returned |
| `reviewed_by` | uuid | Admin user |
| `reviewed_at` | timestamptz | Decision time |

### `notices`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Nullable for org-wide |
| `title` | text | Notice title |
| `body` | text | Notice content |
| `audience` | text | all, hostel, room, residents |
| `published_at` | timestamptz | Null for draft |
| `created_by` | uuid | Admin user |

### `notifications`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `recipient_user_id` | uuid | Receiver |
| `channel` | text | in_app, email, sms, whatsapp |
| `title` | text | Message title |
| `body` | text | Message body |
| `status` | text | queued, sent, failed, read |
| `sent_at` | timestamptz | Delivery time |

### `gallery`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Optional branch |
| `title` | text | Media title |
| `storage_path` | text | Supabase Storage path |
| `category` | text | rooms, facilities, events |
| `is_published` | boolean | Public visibility |
| `sort_order` | integer | Display order |

### `website_settings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Optional branch |
| `key` | text | Setting key |
| `value` | jsonb | Flexible setting value |
| `updated_by` | uuid | Admin user |

### `invoices`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `hostel_id` | uuid | Hostel branch |
| `resident_id` | uuid | Resident |
| `invoice_number` | text | Unique per org/hostel |
| `status` | text | draft, issued, paid, cancelled |
| `subtotal` | numeric | Before adjustments/tax |
| `total` | numeric | Final amount |
| `issued_at` | timestamptz | Issue timestamp |
| `pdf_storage_path` | text | Generated PDF file |

### `documents`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `resident_id` | uuid | Resident |
| `document_type` | text | ID proof, agreement, photo, other |
| `storage_path` | text | Supabase Storage path |
| `status` | text | pending, verified, rejected |
| `uploaded_by` | uuid | User |

## Indexing Strategy

Recommended indexes:

```sql
-- Tenant filters
create index on residents (organization_id, hostel_id, status);
create index on rooms (organization_id, hostel_id, status);
create index on payments (organization_id, hostel_id, status, paid_at desc);
create index on monthly_fee_records (organization_id, hostel_id, period_month, status);
create index on leave_requests (organization_id, hostel_id, status, from_date);
create index on notices (organization_id, hostel_id, published_at desc);

-- Uniqueness examples
create unique index residents_admission_unique
  on residents (hostel_id, admission_number);
```

## RLS Strategy

- Residents can read only their own resident records, fees, invoices, leaves, and targeted notices.
- Admins can access records for assigned organization or hostel.
- Owners can access all hostels inside their organization.
- Super admins should have tightly controlled support access.

## Backups and Retention

- Enable Supabase managed backups before production.
- Export financial reports monthly.
- Store generated invoices in protected storage.
- Retain audit logs for a defined compliance period.
- Test restore procedures before launch.

## TODO Placeholders

- TODO: Finalize enum values for statuses.
- TODO: Define RLS policies table by table.
- TODO: Define triggers for `updated_at`.
- TODO: Define audit log schema.
- TODO: Define generated invoice number strategy.
- TODO: Define cash payment reconciliation rules.
- TODO: Generate Supabase TypeScript types after schema creation.

## Future Expansion Notes

- Add materialized views for owner dashboards.
- Add partitioning for audit logs and notifications if volume grows.
- Add ledger-style accounting tables if financial complexity expands.
- Add hostel chain reporting across organizations and branches.

