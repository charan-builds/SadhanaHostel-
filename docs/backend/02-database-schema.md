# Production PostgreSQL Database Architecture

## Purpose

Design the production-grade PostgreSQL and Supabase database architecture for **Sadhana Boys Hostel Platform**, a scalable Hostel ERP, Resident Portal, public CMS, and future multi-hostel SaaS platform.

## Scope

This document defines:

- PostgreSQL schema conventions.
- Supabase Auth integration.
- Multi-tenant organization isolation.
- Required enums.
- Mandatory production tables.
- Relationships and indexing strategy.
- RLS preparation.
- Audit logging.
- Financial consistency rules.
- Future scaling strategy.

## Responsibilities

Backend developers own:

- Database migrations.
- RLS policies.
- Constraints and indexes.
- Business rules.
- Audit logging.
- Generated TypeScript database types.

Frontend developers consume:

- API contracts and view models.
- Shared enums and statuses.
- Paginated responses.

Frontend must not directly manipulate database state from client components. Business writes must pass through server actions, route handlers, or approved server-side services.

## Architecture Overview

```txt
auth.users
  -> public.users
    -> public.user_roles
      -> organizations
        -> hostels
          -> residents
          -> rooms
          -> room_allocations
          -> monthly_fee_records
          -> invoices
          -> payments
          -> leave_requests
          -> notices
          -> notifications
          -> gallery
          -> facilities
          -> documents
          -> support_requests
          -> audit_logs
```

## Recommended PostgreSQL Schema Structure

Use the default Supabase schemas:

| Schema | Purpose |
| --- | --- |
| `auth` | Supabase-managed identity tables, including `auth.users` |
| `public` | Application tables, enums, views, functions, and RLS policies |
| `storage` | Supabase-managed file storage metadata |

Recommended extensions:

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;
```

`pgcrypto` supports `gen_random_uuid()`. `citext` helps case-insensitive emails/slugs if required. `btree_gist` helps exclusion constraints for overlapping room allocations later.

## Naming Conventions

| Item | Convention | Example |
| --- | --- | --- |
| Tables | plural snake_case | `monthly_fee_records` |
| Columns | snake_case | `organization_id` |
| Primary keys | `id uuid` | `id uuid primary key` |
| Foreign keys | `<table_singular>_id` | `resident_id` |
| Timestamps | timestamptz | `created_at timestamptz` |
| Money | numeric(12,2) | `amount numeric(12,2)` |
| Status | enum | `payment_status` |
| Boolean flags | `is_*`, `has_*` | `has_attached_bathroom` |

## Global Table Standards

Every tenant-owned table should include:

```sql
id uuid primary key default gen_random_uuid(),
organization_id uuid not null references organizations(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
created_by uuid null references users(id),
updated_by uuid null references users(id)
```

Soft delete, where required:

```sql
deleted_at timestamptz null,
deleted_by uuid null references users(id)
```

Recommended `updated_at` trigger:

```sql
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

## Multi-Tenant Strategy

### Tenant Model

- `organizations` represents the SaaS tenant or hostel business.
- `hostels` represents one hostel branch under an organization.
- `organization_id` is mandatory on tenant-owned operational records.
- `hostel_id` is mandatory on branch-specific records.
- `user_roles` defines what a user can do inside an organization and optional hostel.

### Tenant Isolation Rules

- All RLS policies must filter by `organization_id`.
- Hostel-level staff must additionally filter by `hostel_id`.
- Public CMS reads must expose only published records for the selected organization/hostel.
- Super admin access must be explicit and audited.

## Supabase Auth Integration

Supabase owns `auth.users`. The application owns `public.users`.

```txt
auth.users.id
  -> public.users.id
```

`public.users.id` should use the same UUID as `auth.users.id`.

Why:

- Supabase handles authentication, email verification, password reset, OAuth, and sessions.
- Application metadata, tenant roles, profile display names, and operational permissions stay in `public.users` and `user_roles`.

Recommended FK:

```sql
id uuid primary key references auth.users(id) on delete cascade
```

Use `on delete cascade` carefully. If legal/audit needs require retaining user history after auth deletion, prefer `on delete restrict` and disable users instead of deleting them.

## Required Enums

```sql
create type app_role as enum (
  'super_admin',
  'owner',
  'admin',
  'staff',
  'resident',
  'parent'
);

create type resident_type as enum (
  'student',
  'employee',
  'other'
);

create type resident_status as enum (
  'draft',
  'active',
  'suspended',
  'checked_out',
  'archived'
);

create type room_status as enum (
  'active',
  'maintenance',
  'inactive',
  'archived'
);

create type allocation_status as enum (
  'active',
  'transferred',
  'completed',
  'cancelled'
);

create type payment_method as enum (
  'cash',
  'upi',
  'bank_transfer',
  'card',
  'netbanking',
  'wallet',
  'cashfree',
  'advance',
  'adjustment'
);

create type payment_status as enum (
  'initiated',
  'pending',
  'verified',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded'
);

create type invoice_status as enum (
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled'
);

create type fee_record_status as enum (
  'pending',
  'partial',
  'paid',
  'overdue',
  'waived',
  'cancelled'
);

create type leave_status as enum (
  'pending',
  'approved',
  'rejected',
  'departed',
  'returned',
  'cancelled'
);

create type notification_channel as enum (
  'in_app',
  'email',
  'sms',
  'whatsapp'
);

create type notification_status as enum (
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled'
);

create type document_type as enum (
  'aadhaar',
  'profile_image',
  'guardian_id',
  'hostel_agreement',
  'invoice_pdf',
  'payment_receipt',
  'other'
);

create type document_status as enum (
  'pending',
  'verified',
  'rejected',
  'expired',
  'archived'
);

create type support_ticket_status as enum (
  'open',
  'in_progress',
  'waiting_on_resident',
  'resolved',
  'closed'
);

create type support_ticket_priority as enum (
  'low',
  'medium',
  'high',
  'urgent'
);

create type cms_status as enum (
  'draft',
  'published',
  'archived'
);
```

## Entity Relationship Explanation

| Relationship | Type | Notes |
| --- | --- | --- |
| Organization to hostels | One-to-many | One tenant can run multiple hostels |
| Organization to users | Many-to-many through `user_roles` | Users can belong to multiple tenants |
| User to resident | Optional one-to-one | Resident portal account links to resident profile |
| Resident to room allocations | One-to-many | Maintains full assignment history |
| Room to allocations | One-to-many | Occupancy is derived from active allocations |
| Resident to monthly fees | One-to-many | Monthly dues and status |
| Monthly fee to invoices | One-to-many or one-to-one by policy | Allows regeneration/corrections if needed |
| Invoice to payments | One-to-many | Supports partial payments |
| Invoice to line items | One-to-many | Recommended for normalized invoice details |
| Payment to allocations | One-to-many | Recommended for advance/partial payment allocation |
| Leave requests to resident | Many-to-one | Full leave history |
| Notices to notifications | One-to-many | Notice publish creates notification rows |
| Documents to resident/invoice/payment | Polymorphic reference | Secure file metadata |
| Webhooks to payments | Many-to-one optional | Raw Cashfree event tracking |

## Table-by-Table Design

### 1. `organizations`

Purpose: SaaS tenant, business owner, or hostel organization. All tenant-owned data rolls up to an organization.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Organization ID |
| `name` | text | not null | Legal/display name |
| `slug` | citext | not null, unique | Tenant slug |
| `status` | text | not null default `'active'` | active, suspended, archived |
| `billing_email` | citext | null | SaaS billing later |
| `contact_phone` | text | null | Primary contact |
| `address_line1` | text | null | Address |
| `address_line2` | text | null | Address |
| `city` | text | null | City |
| `state` | text | null | State |
| `postal_code` | text | null | Postal code |
| `country` | text | not null default `'IN'` | Country |
| `settings` | jsonb | not null default `'{}'::jsonb` | Tenant settings |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create unique index organizations_slug_uidx on organizations (slug) where deleted_at is null;
create index organizations_status_idx on organizations (status);
```

Relationships:

- Parent of `hostels`, `user_roles`, and all tenant data.

Soft delete:

- Use `deleted_at` for SaaS tenant archival. Do not hard delete production tenants.

Multi-tenant strategy:

- `organizations.id` is the root tenant key. All tenant-owned tables reference it.

### Supporting Table: `hostels`

Purpose: Individual hostel branch under an organization. This table is required for real multi-hostel support even though it was not in the mandatory list.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Hostel ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `name` | text | not null | Hostel name |
| `code` | text | not null | Short code for invoices/rooms |
| `slug` | citext | not null | Hostel URL slug |
| `phone` | text | null | Contact |
| `email` | citext | null | Contact |
| `address_line1` | text | null | Address |
| `address_line2` | text | null | Address |
| `city` | text | null | City |
| `state` | text | null | State |
| `postal_code` | text | null | Postal code |
| `capacity` | integer | not null default `0`, check `capacity >= 0` | Optional declared capacity |
| `is_active` | boolean | not null default `true` | Active branch |
| `settings` | jsonb | not null default `'{}'::jsonb` | Hostel-specific settings |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create unique index hostels_org_code_uidx on hostels (organization_id, code) where deleted_at is null;
create unique index hostels_org_slug_uidx on hostels (organization_id, slug) where deleted_at is null;
create index hostels_org_active_idx on hostels (organization_id, is_active);
```

Relationships:

- One organization has many hostels.
- Most operational tables reference both `organization_id` and `hostel_id`.

Soft delete:

- Use soft delete to preserve historical records.

Multi-tenant strategy:

- Every hostel belongs to one organization.

### 2. `users`

Purpose: Application profile linked to Supabase `auth.users`. Stores app-level identity metadata, not passwords.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, FK `auth.users(id)` | Same ID as Supabase auth user |
| `full_name` | text | not null | Display/legal name |
| `email` | citext | null | Denormalized from auth for search/display |
| `phone` | text | null | User phone |
| `avatar_document_id` | uuid | FK `documents(id)`, null | Optional profile image |
| `is_platform_user` | boolean | not null default `false` | For internal support/super admins |
| `is_active` | boolean | not null default `true` | Disable app access |
| `last_login_at` | timestamptz | null | Optional auth tracking |
| `metadata` | jsonb | not null default `'{}'::jsonb` | Non-sensitive metadata |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create index users_email_idx on users (email);
create index users_phone_idx on users (phone);
create index users_active_idx on users (is_active) where deleted_at is null;
```

Relationships:

- One `auth.users` row maps to one `public.users` row.
- User can have many `user_roles`.
- Resident profile can link to a user through `residents.user_id`.

Soft delete:

- Prefer disable with `is_active = false`; use `deleted_at` only for privacy/compliance workflows after legal review.

Multi-tenant strategy:

- Users are global identities. Tenant access is controlled through `user_roles`.

### 3. `user_roles`

Purpose: Membership and RBAC table. Assigns users to organizations and optionally hostels with one or more roles.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Role assignment ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | FK `hostels(id)`, null | Null means organization-wide |
| `user_id` | uuid | not null FK `users(id)` | User |
| `role` | app_role | not null | Role |
| `permissions` | jsonb | not null default `'[]'::jsonb` | Optional fine-grained overrides |
| `status` | text | not null default `'active'` | active, invited, suspended |
| `invited_by` | uuid | FK `users(id)`, null | Invite tracking |
| `invited_at` | timestamptz | null | Invite tracking |
| `accepted_at` | timestamptz | null | Invite tracking |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Constraints:

```sql
alter table user_roles
  add constraint user_roles_status_chk
  check (status in ('active', 'invited', 'suspended'));
```

Indexes:

```sql
create unique index user_roles_unique_active_uidx
  on user_roles (organization_id, coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id, role)
  where deleted_at is null;

create index user_roles_user_idx on user_roles (user_id, status);
create index user_roles_org_role_idx on user_roles (organization_id, role, status);
create index user_roles_hostel_role_idx on user_roles (hostel_id, role, status);
```

Relationships:

- A user can have multiple roles across organizations or hostels.
- RLS policies should use this table to determine tenant access.

Soft delete:

- Use soft delete for revocation history. Also set `status = 'suspended'` when immediate access removal is needed.

Multi-tenant strategy:

- `organization_id` is mandatory. `hostel_id` scopes access to one hostel when present.

### 4. `residents`

Purpose: Resident/student/employee profile and operational identity. Supports portal account linking, parent contacts, emergency contacts, Aadhaar/document uploads, and lifecycle status.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Resident ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel branch |
| `user_id` | uuid | FK `users(id)`, null, unique when not null | Portal account |
| `resident_type` | resident_type | not null default `'student'` | student/employee/other |
| `admission_number` | text | not null | Unique per hostel |
| `full_name` | text | not null | Legal name |
| `preferred_name` | text | null | Optional |
| `gender` | text | null | Keep flexible unless policy fixed |
| `date_of_birth` | date | null | DOB |
| `phone` | text | null | Resident phone |
| `email` | citext | null | Resident email |
| `aadhaar_last4` | text | null, check length 4 if present | Never store full Aadhaar unless legally approved |
| `aadhaar_document_id` | uuid | FK `documents(id)`, null | Secure Aadhaar upload reference |
| `profile_image_document_id` | uuid | FK `documents(id)`, null | Profile image |
| `parent_name` | text | null | Parent/guardian |
| `parent_phone` | text | null | Parent/guardian |
| `parent_email` | citext | null | Parent/guardian |
| `parent_user_id` | uuid | FK `users(id)`, null | Future parent portal |
| `emergency_contact_name` | text | null | Emergency contact |
| `emergency_contact_phone` | text | null | Emergency contact |
| `permanent_address` | text | null | Address |
| `current_status` | resident_status | not null default `'draft'` | Lifecycle |
| `joined_on` | date | null | Admission date |
| `checkout_on` | date | null | Checkout date |
| `monthly_fee_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Default fee |
| `security_deposit_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Deposit |
| `notes` | text | null | Internal notes |
| `metadata` | jsonb | not null default `'{}'::jsonb` | Flexible non-critical fields |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Constraints:

```sql
alter table residents
  add constraint residents_aadhaar_last4_chk
  check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$');

alter table residents
  add constraint residents_checkout_after_join_chk
  check (checkout_on is null or joined_on is null or checkout_on >= joined_on);
```

Indexes:

```sql
create unique index residents_admission_uidx
  on residents (hostel_id, admission_number)
  where deleted_at is null;

create unique index residents_user_uidx
  on residents (user_id)
  where user_id is not null and deleted_at is null;

create index residents_org_hostel_status_idx on residents (organization_id, hostel_id, current_status);
create index residents_name_search_idx on residents using gin (to_tsvector('simple', full_name));
create index residents_phone_idx on residents (phone);
create index residents_parent_phone_idx on residents (parent_phone);
```

Relationships:

- Resident belongs to organization and hostel.
- Resident can have one linked portal `user_id`.
- Resident has many room allocations, fee records, payments, invoices, leaves, documents, support requests.

Soft delete:

- Use soft delete only for mistaken duplicate profiles. Normal exits should use `current_status = 'checked_out'`.

Multi-tenant strategy:

- All resident queries must filter by `organization_id`; hostel staff additionally filter by `hostel_id`.

### 5. `rooms`

Purpose: Room inventory and pricing attributes. Occupancy is derived from active room allocations.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Room ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `room_number` | text | not null | Unique per hostel |
| `room_name` | text | null | Optional display |
| `floor` | text | null | Floor label |
| `block_name` | text | null | Block/wing |
| `capacity` | integer | not null, check `capacity > 0` | Max residents |
| `base_monthly_fee` | numeric(12,2) | not null default `0`, check `>= 0` | Default room price |
| `has_attached_bathroom` | boolean | not null default `false` | Facility flag |
| `has_ac` | boolean | not null default `false` | Facility flag |
| `status` | room_status | not null default `'active'` | Room lifecycle |
| `description` | text | null | Internal/public description |
| `metadata` | jsonb | not null default `'{}'::jsonb` | Extra attributes |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create unique index rooms_hostel_room_number_uidx
  on rooms (hostel_id, room_number)
  where deleted_at is null;

create index rooms_org_hostel_status_idx on rooms (organization_id, hostel_id, status);
create index rooms_capacity_idx on rooms (hostel_id, capacity);
```

Relationships:

- Room has many allocations.
- Room occupancy is count of active `room_allocations`.

Soft delete:

- Prefer `status = 'inactive'` for old rooms. Soft delete only for mistaken records.

Multi-tenant strategy:

- `organization_id` and `hostel_id` are mandatory.

### 6. `room_allocations`

Purpose: Historical and active room assignment records. Enables room history, transfers, checkout, and occupancy tracking.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Allocation ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `resident_id` | uuid | not null FK `residents(id)` | Resident |
| `room_id` | uuid | not null FK `rooms(id)` | Room |
| `bed_label` | text | null | Optional bed label |
| `allocated_from` | date | not null | Start date |
| `allocated_to` | date | null | End date |
| `status` | allocation_status | not null default `'active'` | Allocation status |
| `monthly_fee_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Fee at allocation time |
| `reason` | text | null | Transfer/checkout reason |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Constraints:

```sql
alter table room_allocations
  add constraint room_allocations_date_chk
  check (allocated_to is null or allocated_to >= allocated_from);
```

Recommended advanced occupancy constraints:

- Prevent one resident from multiple active allocations.
- Prevent room occupancy from exceeding capacity through trigger or transactional function.
- If using bed labels, prevent duplicate active bed allocations.

Indexes:

```sql
create unique index room_allocations_one_active_resident_uidx
  on room_allocations (resident_id)
  where status = 'active' and deleted_at is null;

create index room_allocations_room_active_idx
  on room_allocations (room_id, status)
  where deleted_at is null;

create index room_allocations_org_hostel_idx
  on room_allocations (organization_id, hostel_id, status);
```

Relationships:

- Resident has many allocations.
- Room has many allocations.

Soft delete:

- Avoid deleting allocation history. Use `status = 'completed'`, `transferred`, or `cancelled`.

Multi-tenant strategy:

- Allocation must match resident and room tenant/hostel. Enforce with triggers or composite FKs later.

### 7. `monthly_fee_records`

Purpose: Monthly resident due ledger. Supports monthly fee generation, due tracking, partial payments, waivers, and invoice linkage.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Fee record ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `resident_id` | uuid | not null FK `residents(id)` | Resident |
| `room_allocation_id` | uuid | FK `room_allocations(id)`, null | Snapshot source |
| `period_month` | date | not null | First day of month |
| `due_date` | date | not null | Due date |
| `base_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Base fee |
| `discount_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Discounts |
| `penalty_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Late fees |
| `adjustment_amount` | numeric(12,2) | not null default `0` | Positive/negative adjustment |
| `total_amount` | numeric(12,2) | not null, check `>= 0` | Due total |
| `paid_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Denormalized paid |
| `balance_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Denormalized balance |
| `status` | fee_record_status | not null default `'pending'` | Fee status |
| `generated_at` | timestamptz | not null default `now()` | Generation time |
| `notes` | text | null | Internal notes |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Constraints:

```sql
alter table monthly_fee_records
  add constraint monthly_fee_period_first_day_chk
  check (period_month = date_trunc('month', period_month)::date);

alter table monthly_fee_records
  add constraint monthly_fee_paid_not_over_total_chk
  check (paid_amount <= total_amount);
```

Indexes:

```sql
create unique index monthly_fee_records_unique_period_uidx
  on monthly_fee_records (resident_id, period_month)
  where deleted_at is null;

create index monthly_fee_org_hostel_period_status_idx
  on monthly_fee_records (organization_id, hostel_id, period_month, status);

create index monthly_fee_resident_status_idx
  on monthly_fee_records (resident_id, status);
```

Relationships:

- Resident has many monthly fee records.
- Payments and invoices can reference fee records.

Soft delete:

- Avoid delete after invoice/payment exists. Use `status = 'cancelled'` or adjustment rows.

Multi-tenant strategy:

- Must match resident organization/hostel.

### 8. `payments`

Purpose: Payment records for online, cash, advance, partial, refund, and adjustment workflows. Internal payment records are the financial source of truth, not Cashfree alone.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Payment ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `resident_id` | uuid | not null FK `residents(id)` | Resident |
| `monthly_fee_record_id` | uuid | FK `monthly_fee_records(id)`, null | Fee link |
| `invoice_id` | uuid | FK `invoices(id)`, null | Invoice link |
| `amount` | numeric(12,2) | not null, check `amount > 0` | Payment amount |
| `method` | payment_method | not null | cash/cashfree/etc |
| `status` | payment_status | not null default `'initiated'` | Payment status |
| `is_advance` | boolean | not null default `false` | Advance payment |
| `cashfree_order_id` | text | null | Cashfree order |
| `cashfree_payment_id` | text | null | Cashfree payment |
| `provider_reference` | text | null | External ref |
| `manual_reference` | text | null | UPI/cash receipt ref |
| `verified_by` | uuid | FK `users(id)`, null | Admin verifier |
| `verified_at` | timestamptz | null | Verification time |
| `paid_at` | timestamptz | null | Payment time |
| `failure_reason` | text | null | Provider/manual failure |
| `notes` | text | null | Internal notes |
| `metadata` | jsonb | not null default `'{}'::jsonb` | Provider payload summary |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create index payments_org_hostel_paid_idx on payments (organization_id, hostel_id, paid_at desc);
create index payments_resident_status_idx on payments (resident_id, status);
create index payments_invoice_idx on payments (invoice_id);
create index payments_fee_record_idx on payments (monthly_fee_record_id);
create unique index payments_cashfree_order_uidx on payments (cashfree_order_id) where cashfree_order_id is not null;
create unique index payments_cashfree_payment_uidx on payments (cashfree_payment_id) where cashfree_payment_id is not null;
```

Relationships:

- Payment belongs to resident.
- Payment can settle one invoice and/or fee record.
- Payment webhooks link through Cashfree references.

Soft delete:

- Do not soft delete verified payments. Use reversal/refund records or status transitions.

Multi-tenant strategy:

- Payment must match resident/invoice/fee record tenant.

Financial consistency:

- Payment verification must run in transaction with fee/invoice balance update.
- Never mark online payment verified from browser redirect alone.

### 9. `invoices`

Purpose: Billing document header for resident fees, deposits, penalties, adjustments, and receipts/PDF generation.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Invoice ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `resident_id` | uuid | not null FK `residents(id)` | Resident |
| `monthly_fee_record_id` | uuid | FK `monthly_fee_records(id)`, null | Fee link |
| `invoice_number` | text | not null | Unique per organization/hostel |
| `status` | invoice_status | not null default `'draft'` | Lifecycle |
| `issue_date` | date | not null default `current_date` | Issue date |
| `due_date` | date | null | Due date |
| `subtotal_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Subtotal |
| `discount_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Discount |
| `tax_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Future tax |
| `total_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Total |
| `paid_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Paid |
| `balance_amount` | numeric(12,2) | not null default `0`, check `>= 0` | Balance |
| `pdf_document_id` | uuid | FK `documents(id)`, null | Generated PDF |
| `cancelled_at` | timestamptz | null | Cancellation |
| `cancelled_by` | uuid | FK `users(id)`, null | Cancellation |
| `cancellation_reason` | text | null | Required if cancelled |
| `metadata` | jsonb | not null default `'{}'::jsonb` | Invoice details/line snapshots until line table added |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Constraints:

```sql
alter table invoices
  add constraint invoices_paid_not_over_total_chk
  check (paid_amount <= total_amount);
```

Indexes:

```sql
create unique index invoices_org_number_uidx
  on invoices (organization_id, invoice_number)
  where deleted_at is null;

create index invoices_org_hostel_status_idx on invoices (organization_id, hostel_id, status);
create index invoices_resident_issue_idx on invoices (resident_id, issue_date desc);
create index invoices_fee_record_idx on invoices (monthly_fee_record_id);
```

Relationships:

- Resident has many invoices.
- Invoice can have many payments.
- Invoice PDF stored through documents.

Soft delete:

- Do not delete issued invoices. Use `status = 'cancelled'`.

Multi-tenant strategy:

- Invoice numbering can include hostel code but uniqueness should be enforced at organization level.

Future note:

- Add `invoice_line_items` when generating detailed tax/charge rows. It is strongly recommended before launch even though not mandatory in this request.

### Recommended Supporting Table: `invoice_line_items`

Purpose: Normalized invoice charges, discounts, penalties, deposits, and tax rows. This avoids hiding important financial data inside invoice JSON.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Line item ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `invoice_id` | uuid | not null FK `invoices(id)` | Invoice |
| `monthly_fee_record_id` | uuid | FK `monthly_fee_records(id)`, null | Optional source |
| `item_type` | text | not null | rent, deposit, penalty, discount, adjustment, tax |
| `description` | text | not null | Display line |
| `quantity` | numeric(10,2) | not null default `1`, check `quantity > 0` | Quantity |
| `unit_amount` | numeric(12,2) | not null default `0` | Unit price |
| `line_amount` | numeric(12,2) | not null | Final line amount |
| `sort_order` | integer | not null default `0` | Invoice order |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |

Indexes:

```sql
create index invoice_line_items_invoice_idx on invoice_line_items (invoice_id, sort_order);
create index invoice_line_items_org_hostel_idx on invoice_line_items (organization_id, hostel_id);
```

### Recommended Supporting Table: `payment_allocations`

Purpose: Normalized mapping between payments and invoices/monthly fee records. This supports advance payments, partial payments, and one payment covering multiple dues.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Allocation ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `payment_id` | uuid | not null FK `payments(id)` | Payment |
| `invoice_id` | uuid | FK `invoices(id)`, null | Invoice settled |
| `monthly_fee_record_id` | uuid | FK `monthly_fee_records(id)`, null | Fee settled |
| `allocated_amount` | numeric(12,2) | not null, check `allocated_amount > 0` | Amount allocated |
| `allocated_at` | timestamptz | not null default `now()` | Allocation time |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |

Constraints:

```sql
alter table payment_allocations
  add constraint payment_allocations_target_chk
  check (invoice_id is not null or monthly_fee_record_id is not null);
```

Indexes:

```sql
create index payment_allocations_payment_idx on payment_allocations (payment_id);
create index payment_allocations_invoice_idx on payment_allocations (invoice_id);
create index payment_allocations_fee_idx on payment_allocations (monthly_fee_record_id);
```

### 10. `leave_requests`

Purpose: Resident leave workflow with approval/rejection, parent notification, departure, return, and history.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Leave ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `resident_id` | uuid | not null FK `residents(id)` | Resident |
| `from_date` | date | not null | Start |
| `to_date` | date | not null | End |
| `reason` | text | not null | Resident reason |
| `destination` | text | null | Where resident goes |
| `parent_notified_at` | timestamptz | null | Parent notification |
| `status` | leave_status | not null default `'pending'` | Workflow status |
| `reviewed_by` | uuid | FK `users(id)`, null | Admin |
| `reviewed_at` | timestamptz | null | Review time |
| `rejection_reason` | text | null | Required when rejected |
| `departed_at` | timestamptz | null | Departure |
| `returned_at` | timestamptz | null | Return |
| `notes` | text | null | Admin notes |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Constraints:

```sql
alter table leave_requests
  add constraint leave_dates_chk check (to_date >= from_date);

alter table leave_requests
  add constraint leave_rejection_reason_chk
  check (status <> 'rejected' or rejection_reason is not null);
```

Indexes:

```sql
create index leave_org_hostel_status_idx on leave_requests (organization_id, hostel_id, status, from_date);
create index leave_resident_date_idx on leave_requests (resident_id, from_date desc);
```

Relationships:

- Resident has many leave requests.
- Notifications can be generated for status transitions.

Soft delete:

- Avoid deleting history. Use `status = 'cancelled'` where appropriate.

Multi-tenant strategy:

- Must match resident organization/hostel.

### 11. `notices`

Purpose: Admin-published notices, announcements, and policy messages. Notices can target all residents, hostels, rooms, or selected residents through JSON audience filters.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Notice ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | FK `hostels(id)`, null | Null for org-wide |
| `title` | text | not null | Notice title |
| `body` | text | not null | Notice content |
| `status` | cms_status | not null default `'draft'` | draft/published/archived |
| `audience_type` | text | not null default `'all'` | all, hostel, room, residents, roles |
| `audience_filter` | jsonb | not null default `'{}'::jsonb` | Targeting details |
| `is_pinned` | boolean | not null default `false` | Important notice |
| `published_at` | timestamptz | null | Publish time |
| `published_by` | uuid | FK `users(id)`, null | Publisher |
| `expires_at` | timestamptz | null | Optional expiry |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create index notices_org_hostel_status_idx on notices (organization_id, hostel_id, status, published_at desc);
create index notices_published_idx on notices (organization_id, published_at desc) where status = 'published';
create index notices_audience_gin_idx on notices using gin (audience_filter);
```

Relationships:

- Notice can generate many `notifications`.

Soft delete:

- Use `status = 'archived'` for normal removal.

Multi-tenant strategy:

- Public/resident reads must filter organization and audience.

### 12. `notifications`

Purpose: In-app notification records and delivery state for users/residents. Supports future email/SMS/WhatsApp channels.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Notification ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | FK `hostels(id)`, null | Optional hostel |
| `recipient_user_id` | uuid | FK `users(id)`, null | User receiver |
| `resident_id` | uuid | FK `residents(id)`, null | Resident receiver |
| `notice_id` | uuid | FK `notices(id)`, null | Source notice |
| `channel` | notification_channel | not null default `'in_app'` | Channel |
| `status` | notification_status | not null default `'queued'` | Delivery state |
| `title` | text | not null | Message title |
| `body` | text | not null | Message body |
| `template_key` | text | null | Template |
| `payload` | jsonb | not null default `'{}'::jsonb` | Extra context |
| `scheduled_for` | timestamptz | null | Future send |
| `sent_at` | timestamptz | null | Sent |
| `delivered_at` | timestamptz | null | Delivered |
| `read_at` | timestamptz | null | Read |
| `failure_reason` | text | null | Failure |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Constraints:

```sql
alter table notifications
  add constraint notifications_recipient_chk
  check (recipient_user_id is not null or resident_id is not null);
```

Indexes:

```sql
create index notifications_user_status_idx on notifications (recipient_user_id, status, created_at desc);
create index notifications_resident_status_idx on notifications (resident_id, status, created_at desc);
create index notifications_org_channel_status_idx on notifications (organization_id, channel, status);
create index notifications_scheduled_idx on notifications (scheduled_for) where status = 'queued';
```

Relationships:

- Can link to a notice.
- Delivery attempts are recorded in `notification_logs`.

Soft delete:

- Soft delete for user cleanup only. Preserve important delivery history in logs.

Multi-tenant strategy:

- Always scoped by `organization_id`; recipient must belong to same tenant.

### 13. `gallery`

Purpose: CMS-managed public images and albums for hostel website.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Gallery item ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | FK `hostels(id)`, null | Optional branch |
| `document_id` | uuid | not null FK `documents(id)` | Image file |
| `title` | text | not null | Display title |
| `description` | text | null | Description |
| `alt_text` | text | null | Accessibility/SEO |
| `category` | text | not null default `'general'` | rooms/facilities/events/etc |
| `sort_order` | integer | not null default `0` | Ordering |
| `status` | cms_status | not null default `'draft'` | CMS lifecycle |
| `published_at` | timestamptz | null | Published |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create index gallery_public_idx on gallery (organization_id, hostel_id, status, sort_order);
create index gallery_category_idx on gallery (organization_id, category, status);
```

Relationships:

- Gallery uses `documents` for storage metadata.

Soft delete:

- Use `status = 'archived'` for normal unpublish.

Multi-tenant strategy:

- Public queries must filter organization/hostel and `status = 'published'`.

### 14. `website_settings`

Purpose: CMS settings for homepage, pricing, contact info, SEO settings, policies, and editable website content.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Setting/content ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | FK `hostels(id)`, null | Null for org-wide |
| `section_key` | text | not null | homepage, pricing, contact, seo, terms |
| `title` | text | null | Optional title |
| `content` | jsonb | not null default `'{}'::jsonb` | Structured content |
| `status` | cms_status | not null default `'draft'` | CMS status |
| `seo_title` | text | null | SEO |
| `seo_description` | text | null | SEO |
| `published_at` | timestamptz | null | Published |
| `published_by` | uuid | FK `users(id)`, null | Publisher |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create unique index website_settings_section_uidx
  on website_settings (organization_id, coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid), section_key)
  where deleted_at is null;

create index website_settings_status_idx on website_settings (organization_id, hostel_id, status);
create index website_settings_content_gin_idx on website_settings using gin (content);
```

Relationships:

- Belongs to organization and optionally hostel.

Soft delete:

- Use archival for old content versions. Consider separate versioning table later.

Multi-tenant strategy:

- Website content is tenant-scoped; future custom domains resolve to organization/hostel.

### 15. `facilities`

Purpose: CMS-managed hostel facilities such as food, Wi-Fi, laundry, housekeeping, security, study area, and pricing inclusions.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Facility ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | FK `hostels(id)`, null | Optional branch |
| `name` | text | not null | Facility name |
| `slug` | citext | not null | URL/display key |
| `description` | text | null | Facility details |
| `icon_name` | text | null | UI icon key |
| `image_document_id` | uuid | FK `documents(id)`, null | Facility image |
| `is_highlighted` | boolean | not null default `false` | Homepage highlight |
| `sort_order` | integer | not null default `0` | Ordering |
| `status` | cms_status | not null default `'draft'` | CMS lifecycle |
| `published_at` | timestamptz | null | Publish time |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create unique index facilities_slug_uidx
  on facilities (organization_id, coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid), slug)
  where deleted_at is null;

create index facilities_public_idx on facilities (organization_id, hostel_id, status, sort_order);
```

Relationships:

- Optional image from `documents`.

Soft delete:

- Use `status = 'archived'` for unpublish.

Multi-tenant strategy:

- Facility content scoped to organization and optional hostel.

### 16. `documents`

Purpose: Secure file metadata for Aadhaar uploads, profile images, invoices, receipts, agreements, gallery images, and future attachments.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Document ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | FK `hostels(id)`, null | Optional |
| `resident_id` | uuid | FK `residents(id)`, null | Resident owner |
| `uploaded_by_user_id` | uuid | FK `users(id)`, null | Uploader |
| `document_type` | document_type | not null | Type |
| `status` | document_status | not null default `'pending'` | Verification status |
| `bucket_name` | text | not null | Supabase bucket |
| `storage_path` | text | not null | File path |
| `file_name` | text | not null | Original/display name |
| `mime_type` | text | not null | MIME type |
| `file_size_bytes` | bigint | not null, check `> 0` | File size |
| `checksum` | text | null | Optional integrity hash |
| `verified_by` | uuid | FK `users(id)`, null | Verifier |
| `verified_at` | timestamptz | null | Verification |
| `rejection_reason` | text | null | If rejected |
| `is_public` | boolean | not null default `false` | Gallery/CMS only |
| `metadata` | jsonb | not null default `'{}'::jsonb` | Extra file metadata |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create unique index documents_storage_path_uidx
  on documents (bucket_name, storage_path)
  where deleted_at is null;

create index documents_resident_type_idx on documents (resident_id, document_type, status);
create index documents_org_type_idx on documents (organization_id, document_type, status);
create index documents_public_idx on documents (organization_id, is_public) where is_public = true;
```

Relationships:

- Can be referenced by residents, invoices, gallery, facilities, and website content.

Soft delete:

- Soft delete metadata first. Actual storage deletion should be controlled by retention policy.

Multi-tenant strategy:

- Storage path should include organization ID, for example:

```txt
organizations/{organization_id}/hostels/{hostel_id}/residents/{resident_id}/aadhaar/{document_id}.pdf
```

Security:

- Do not store full Aadhaar numbers. Store only last four digits if needed and secure file reference.

### 17. `audit_logs`

Purpose: Immutable-ish audit trail for sensitive actions, including financial updates, role changes, resident lifecycle, document verification, CMS publishing, and settings changes.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Audit ID |
| `organization_id` | uuid | FK `organizations(id)`, null | Null only for platform-level events |
| `hostel_id` | uuid | FK `hostels(id)`, null | Optional |
| `actor_user_id` | uuid | FK `users(id)`, null | User/system actor |
| `action` | text | not null | e.g. `payment.verified` |
| `entity_type` | text | not null | Table/domain |
| `entity_id` | uuid | null | Target ID |
| `before_data` | jsonb | null | Before snapshot |
| `after_data` | jsonb | null | After snapshot |
| `ip_address` | inet | null | Request IP |
| `user_agent` | text | null | Request UA |
| `request_id` | text | null | Correlation ID |
| `metadata` | jsonb | not null default `'{}'::jsonb` | Extra |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Required standard; should not change |
| `created_by` | uuid | FK `users(id)`, null | Usually actor |
| `updated_by` | uuid | FK `users(id)`, null | Usually null |

Indexes:

```sql
create index audit_logs_org_time_idx on audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx on audit_logs (action, created_at desc);
```

Relationships:

- References actor and tenant. Entity reference is intentionally generic.

Soft delete:

- No soft delete. Audit logs should not be deleted by normal app flows.

Multi-tenant strategy:

- Tenant admins can view only their organization logs. Platform logs require super admin.

### 18. `payment_webhooks`

Purpose: Raw and normalized Cashfree webhook event tracking for idempotency, reconciliation, debugging, and auditability.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Webhook ID |
| `organization_id` | uuid | FK `organizations(id)`, null | Resolved tenant if known |
| `hostel_id` | uuid | FK `hostels(id)`, null | Resolved hostel if known |
| `payment_id` | uuid | FK `payments(id)`, null | Internal payment |
| `provider` | text | not null default `'cashfree'` | Provider |
| `event_id` | text | null | Provider event ID |
| `event_type` | text | not null | Provider event type |
| `cashfree_order_id` | text | null | Cashfree order |
| `cashfree_payment_id` | text | null | Cashfree payment |
| `signature_valid` | boolean | not null default `false` | Verification |
| `processing_status` | text | not null default `'received'` | received, processed, ignored, failed |
| `received_payload` | jsonb | not null | Raw payload |
| `headers` | jsonb | not null default `'{}'::jsonb` | Safe headers |
| `processed_at` | timestamptz | null | Processing time |
| `failure_reason` | text | null | Failure |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Usually null/system |
| `updated_by` | uuid | FK `users(id)`, null | Usually null/system |

Indexes:

```sql
create unique index payment_webhooks_provider_event_uidx
  on payment_webhooks (provider, event_id)
  where event_id is not null;

create index payment_webhooks_order_idx on payment_webhooks (cashfree_order_id);
create index payment_webhooks_payment_idx on payment_webhooks (payment_id);
create index payment_webhooks_status_idx on payment_webhooks (processing_status, created_at desc);
```

Relationships:

- May link to internal `payments`.

Soft delete:

- No soft delete. Retain for reconciliation and dispute investigation.

Multi-tenant strategy:

- Organization may be null until event is matched to payment/order.

### 19. `notification_logs`

Purpose: Delivery attempt logs for notifications across email, SMS, WhatsApp, and in-app channels.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Log ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | FK `hostels(id)`, null | Optional |
| `notification_id` | uuid | not null FK `notifications(id)` | Notification |
| `channel` | notification_channel | not null | Channel |
| `provider` | text | null | Email/SMS provider |
| `provider_message_id` | text | null | Provider ID |
| `status` | notification_status | not null | Attempt status |
| `attempt_number` | integer | not null default `1`, check `> 0` | Retry count |
| `request_payload` | jsonb | null | Sanitized request |
| `response_payload` | jsonb | null | Sanitized response |
| `error_message` | text | null | Failure reason |
| `sent_at` | timestamptz | null | Sent |
| `delivered_at` | timestamptz | null | Delivered |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Usually system |
| `updated_by` | uuid | FK `users(id)`, null | Usually system |

Indexes:

```sql
create index notification_logs_notification_idx on notification_logs (notification_id, created_at desc);
create index notification_logs_org_status_idx on notification_logs (organization_id, status, created_at desc);
create index notification_logs_provider_message_idx on notification_logs (provider, provider_message_id);
```

Relationships:

- Many delivery logs can belong to one notification.

Soft delete:

- No soft delete for delivery history. Consider retention policy later.

Multi-tenant strategy:

- Logs inherit tenant from notification.

### 20. `support_requests`

Purpose: Resident/staff support tickets for complaints, maintenance, payment questions, leave issues, and general help.

| Column | Type | Constraints / Defaults | Notes |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` | Ticket ID |
| `organization_id` | uuid | not null FK `organizations(id)` | Tenant |
| `hostel_id` | uuid | not null FK `hostels(id)` | Hostel |
| `resident_id` | uuid | FK `residents(id)`, null | Resident requester |
| `created_by_user_id` | uuid | FK `users(id)`, null | Requester |
| `assigned_to_user_id` | uuid | FK `users(id)`, null | Staff/admin |
| `category` | text | not null default `'general'` | maintenance/payment/leave/etc |
| `priority` | support_ticket_priority | not null default `'medium'` | Priority |
| `status` | support_ticket_status | not null default `'open'` | Ticket status |
| `subject` | text | not null | Subject |
| `description` | text | not null | Details |
| `resolution_notes` | text | null | Resolution |
| `resolved_at` | timestamptz | null | Resolution time |
| `closed_at` | timestamptz | null | Closure |
| `metadata` | jsonb | not null default `'{}'::jsonb` | Attachments/context |
| `created_at` | timestamptz | not null default `now()` | Audit |
| `updated_at` | timestamptz | not null default `now()` | Audit |
| `created_by` | uuid | FK `users(id)`, null | Audit |
| `updated_by` | uuid | FK `users(id)`, null | Audit |
| `deleted_at` | timestamptz | null | Soft delete |
| `deleted_by` | uuid | FK `users(id)`, null | Soft delete |

Indexes:

```sql
create index support_org_hostel_status_idx on support_requests (organization_id, hostel_id, status, priority);
create index support_resident_idx on support_requests (resident_id, created_at desc);
create index support_assigned_idx on support_requests (assigned_to_user_id, status);
```

Relationships:

- Resident can create many support requests.
- Staff/admin can be assigned tickets.
- Attachments can be referenced via `documents` metadata initially.

Soft delete:

- Prefer `closed` status for normal lifecycle. Soft delete spam/mistakes only.

Multi-tenant strategy:

- Must be tenant and hostel scoped.

## Suggested Supporting Views

### Current Room Occupancy View

```sql
create view room_occupancy_view as
select
  r.organization_id,
  r.hostel_id,
  r.id as room_id,
  r.capacity,
  count(ra.id) filter (where ra.status = 'active' and ra.deleted_at is null) as occupied_count,
  r.capacity - count(ra.id) filter (where ra.status = 'active' and ra.deleted_at is null) as available_count
from rooms r
left join room_allocations ra on ra.room_id = r.id
where r.deleted_at is null
group by r.organization_id, r.hostel_id, r.id, r.capacity;
```

### Resident Balance View

```sql
create view resident_balance_view as
select
  organization_id,
  hostel_id,
  resident_id,
  sum(balance_amount) as total_due
from monthly_fee_records
where deleted_at is null
  and status in ('pending', 'partial', 'overdue')
group by organization_id, hostel_id, resident_id;
```

## Suggested Index Summary

High-priority indexes before production:

```sql
-- Tenant and status filters
create index residents_org_hostel_status_idx on residents (organization_id, hostel_id, current_status);
create index rooms_org_hostel_status_idx on rooms (organization_id, hostel_id, status);
create index monthly_fee_org_hostel_period_status_idx on monthly_fee_records (organization_id, hostel_id, period_month, status);
create index payments_org_hostel_paid_idx on payments (organization_id, hostel_id, paid_at desc);
create index invoices_org_hostel_status_idx on invoices (organization_id, hostel_id, status);
create index leave_org_hostel_status_idx on leave_requests (organization_id, hostel_id, status, from_date);

-- User access
create index user_roles_user_idx on user_roles (user_id, status);
create index user_roles_org_role_idx on user_roles (organization_id, role, status);

-- Provider reconciliation
create unique index payments_cashfree_order_uidx on payments (cashfree_order_id) where cashfree_order_id is not null;
create unique index payment_webhooks_provider_event_uidx on payment_webhooks (provider, event_id) where event_id is not null;
```

## Supabase RLS Preparation Strategy

### RLS Policy Building Blocks

Create helper functions after schema is implemented:

```sql
create or replace function current_user_has_role(
  target_organization_id uuid,
  allowed_roles app_role[]
)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from user_roles ur
    where ur.user_id = auth.uid()
      and ur.organization_id = target_organization_id
      and ur.role = any(allowed_roles)
      and ur.status = 'active'
      and ur.deleted_at is null
  );
$$;
```

### RLS Rules by Area

| Area | Rule |
| --- | --- |
| Public CMS | Anonymous users can read published website content only |
| Residents | Residents can read own profile only |
| Payments | Residents can read own payments/invoices only |
| Leaves | Residents can create/read own leave requests |
| Admin ERP | Admin/staff access restricted by `user_roles` organization/hostel |
| Super admin | Platform access explicit, audited, and preferably limited |
| Documents | Private by default, signed URL access only |

### RLS Checklist

- Enable RLS on every tenant-owned table.
- Add select policies before insert/update/delete policies.
- Test resident cannot read another resident's records.
- Test hostel staff cannot access another hostel.
- Test public CMS cannot expose drafts.
- Test service role code paths are server-only.

## Financial Consistency Recommendations

1. Use transactions for payment verification, invoice updates, and fee balance updates.
2. Never trust frontend payment success.
3. Cashfree webhook verification is required.
4. Store every webhook event in `payment_webhooks`.
5. Make webhook processing idempotent by provider event/order/payment ID.
6. Avoid deleting payments, invoices, or monthly fee records after issuance.
7. Use adjustment records or statuses for corrections.
8. Add audit logs for all financial state changes.
9. Use numeric precision for money, not floating point.
10. Consider a future `ledger_entries` table before advanced accounting.

## Audit Logging Strategy

Audit these actions:

- User role created, updated, suspended, deleted.
- Resident created, updated, checked out, archived.
- Room allocation created, transferred, completed.
- Monthly fee generated, waived, adjusted.
- Payment initiated, verified, failed, refunded.
- Invoice issued, paid, cancelled, PDF generated.
- Leave approved, rejected, departed, returned.
- Document uploaded, verified, rejected, deleted.
- Notice/CMS content published.
- Support ticket status changed.
- Integration settings changed.

Recommended action naming:

```txt
resident.created
room_allocation.transferred
payment.verified
invoice.cancelled
leave.approved
document.verified
cms.published
role.suspended
```

## Security Recommendations

- Never store full Aadhaar numbers unless legally required and encrypted with strict controls.
- Store Aadhaar file references in `documents`; store only `aadhaar_last4` in `residents`.
- Use private Supabase Storage buckets for resident documents and invoices.
- Use signed URLs for secure downloads.
- Use RLS and server-side authorization together.
- Keep Supabase service role key only in server-side environments.
- Rate-limit contact forms, auth attempts, payment order creation, and upload URL creation.
- Mask financial and identity data in logs.
- Add MFA for owner/admin roles before broad production use.

## Performance and Scaling Strategy

### For 100+ Concurrent Users

- Use indexed tenant queries.
- Use server-side pagination for all list pages.
- Avoid dashboard queries that scan full tables.
- Use aggregate views/materialized views for owner dashboards.
- Keep public CMS pages cached and revalidated on publish.
- Use storage CDN for public gallery assets.

### Future Growth

- Partition `audit_logs`, `notifications`, and `payment_webhooks` if they grow large.
- Add materialized views for reporting.
- Add background jobs for monthly fee generation, invoice PDFs, and notifications.
- Add read replicas if reporting load impacts operational queries.
- Add tenant limits and feature flags for SaaS plans.

## Implementation Order

Recommended migration order:

1. Extensions and enums.
2. `organizations`, `users`, `hostels`.
3. `user_roles`.
4. Core operational tables: `residents`, `rooms`, `room_allocations`.
5. Finance tables: `monthly_fee_records`, `invoices`, `payments`, `invoice_line_items`, `payment_allocations`, `payment_webhooks`.
6. Workflow tables: `leave_requests`, `support_requests`.
7. Communication tables: `notices`, `notifications`, `notification_logs`.
8. CMS and file tables: `documents`, `gallery`, `website_settings`, `facilities`.
9. `audit_logs`.
10. Indexes, triggers, RLS policies, and helper functions.

Migration implementation note:

- Some references are naturally circular, such as `users.avatar_document_id`, `residents.aadhaar_document_id`, `invoices.pdf_document_id`, and `documents.resident_id`.
- Create the core tables first without circular optional FKs, then add those FK constraints in a later migration after all referenced tables exist.
- Keep optional document reference columns nullable so profile creation, invoice creation, and upload workflows can complete in separate steps.

## TODO Placeholders

- TODO: Convert this design into Supabase SQL migrations.
- TODO: Decide whether to add `invoice_line_items` in phase one.
- TODO: Decide whether to add `ledger_entries` before Cashfree launch.
- TODO: Define exact RLS policies table by table.
- TODO: Define exact storage bucket policies.
- TODO: Define materialized views for admin dashboard KPIs.
- TODO: Define seed data for first organization and hostel.
- TODO: Generate TypeScript types after migrations.

## Future Scalability Notes

- Add `subscription_plans` and `organization_subscriptions` for SaaS billing.
- Add `hostel_staff_assignments` if staff schedules become complex.
- Add `resident_guardians` if multiple parent/guardian contacts are required.
- Add `room_beds` if bed-level inventory needs stronger modeling than `bed_label`.
- Add `ledger_entries` for full accounting-style financial tracking.
- Add `cms_pages` if website content outgrows `website_settings`.
- Add `message_templates` for notification template management.
- Add `support_request_comments` and `support_request_attachments` for full ticketing.
