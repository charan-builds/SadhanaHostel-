-- Sadhana Boys Hostel Platform
-- Foundation PostgreSQL schema for Supabase.
-- Production-grade Hostel ERP + Resident Portal + CMS + Payments foundation.

begin;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------

create type public.user_role_enum as enum (
  'super_admin',
  'owner',
  'admin',
  'staff',
  'resident',
  'parent'
);

create type public.resident_type_enum as enum (
  'student',
  'employee',
  'other'
);

create type public.resident_status_enum as enum (
  'draft',
  'active',
  'suspended',
  'checked_out',
  'archived'
);

create type public.room_status_enum as enum (
  'active',
  'maintenance',
  'inactive',
  'archived'
);

create type public.room_allocation_status_enum as enum (
  'active',
  'transferred',
  'completed',
  'cancelled'
);

create type public.payment_method_enum as enum (
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

create type public.payment_status_enum as enum (
  'initiated',
  'pending',
  'verified',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded'
);

create type public.fee_record_status_enum as enum (
  'pending',
  'partial',
  'paid',
  'overdue',
  'waived',
  'cancelled'
);

create type public.invoice_status_enum as enum (
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled'
);

create type public.leave_status_enum as enum (
  'pending',
  'approved',
  'rejected',
  'departed',
  'returned',
  'cancelled'
);

create type public.notification_channel_enum as enum (
  'in_app',
  'email',
  'sms',
  'whatsapp'
);

create type public.notification_status_enum as enum (
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled'
);

create type public.cms_status_enum as enum (
  'draft',
  'published',
  'archived'
);

create type public.document_type_enum as enum (
  'aadhaar',
  'profile_image',
  'guardian_id',
  'hostel_agreement',
  'invoice_pdf',
  'payment_receipt',
  'gallery_image',
  'facility_image',
  'support_attachment',
  'other'
);

create type public.document_status_enum as enum (
  'pending',
  'verified',
  'rejected',
  'expired',
  'archived'
);

create type public.support_status_enum as enum (
  'open',
  'in_progress',
  'waiting_on_resident',
  'resolved',
  'closed'
);

create type public.support_priority_enum as enum (
  'low',
  'medium',
  'high',
  'urgent'
);

-- ---------------------------------------------------------------------------
-- Trigger function
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core tenant and identity tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  slug citext not null,
  status text not null default 'active',
  billing_email citext,
  contact_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'IN',
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint organizations_status_chk check (status in ('active', 'suspended', 'archived'))
);

comment on table public.organizations is 'SaaS tenant or hostel business entity. Root isolation key for tenant-owned data.';

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null,
  email citext,
  phone text,
  default_role public.user_role_enum not null default 'resident',
  avatar_document_id uuid,
  is_platform_user boolean not null default false,
  is_active boolean not null default true,
  last_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

comment on table public.users is 'Application profile linked one-to-one with Supabase auth.users. Does not store passwords.';

alter table public.organizations
  add constraint organizations_created_by_fkey foreign key (created_by) references public.users(id) on delete set null,
  add constraint organizations_updated_by_fkey foreign key (updated_by) references public.users(id) on delete set null,
  add constraint organizations_deleted_by_fkey foreign key (deleted_by) references public.users(id) on delete set null;

create table public.hostels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  code text not null,
  slug citext not null,
  phone text,
  email citext,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  capacity integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint hostels_capacity_chk check (capacity >= 0)
);

comment on table public.hostels is 'Hostel branch under an organization. Enables future multi-hostel SaaS support.';

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.user_role_enum not null,
  permissions jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  invited_by uuid references public.users(id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint user_roles_status_chk check (status in ('active', 'invited', 'suspended'))
);

comment on table public.user_roles is 'Tenant and hostel scoped role assignments for RBAC and RLS policy checks.';

-- ---------------------------------------------------------------------------
-- Resident and room operations
-- ---------------------------------------------------------------------------

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  user_id uuid references public.users(id) on delete set null,
  parent_user_id uuid references public.users(id) on delete set null,
  resident_type public.resident_type_enum not null default 'student',
  admission_number text not null,
  full_name text not null,
  preferred_name text,
  gender text,
  date_of_birth date,
  phone text,
  email citext,
  aadhaar_last4 text,
  aadhaar_document_id uuid,
  profile_image_document_id uuid,
  parent_name text,
  parent_phone text,
  parent_email citext,
  emergency_contact_name text,
  emergency_contact_phone text,
  permanent_address text,
  status public.resident_status_enum not null default 'draft',
  joined_on date,
  checkout_on date,
  monthly_fee_amount numeric(12,2) not null default 0,
  security_deposit_amount numeric(12,2) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint residents_aadhaar_last4_chk check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  constraint residents_checkout_after_join_chk check (checkout_on is null or joined_on is null or checkout_on >= joined_on),
  constraint residents_monthly_fee_amount_chk check (monthly_fee_amount >= 0),
  constraint residents_security_deposit_amount_chk check (security_deposit_amount >= 0)
);

comment on table public.residents is 'Resident profile for students, employees, and other occupants. Stores Aadhaar metadata only, not full Aadhaar number.';

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  room_number text not null,
  room_name text,
  room_type text not null default 'shared',
  floor text,
  block_name text,
  capacity integer not null,
  base_monthly_fee numeric(12,2) not null default 0,
  has_attached_bathroom boolean not null default false,
  has_ac boolean not null default false,
  status public.room_status_enum not null default 'active',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint rooms_capacity_chk check (capacity > 0),
  constraint rooms_base_monthly_fee_chk check (base_monthly_fee >= 0)
);

comment on table public.rooms is 'Room inventory. Occupancy is derived from active room_allocations.';

create table public.room_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid not null references public.residents(id) on delete restrict,
  room_id uuid not null references public.rooms(id) on delete restrict,
  bed_label text,
  allocated_from date not null,
  allocated_to date,
  status public.room_allocation_status_enum not null default 'active',
  monthly_fee_amount numeric(12,2) not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint room_allocations_date_chk check (allocated_to is null or allocated_to >= allocated_from),
  constraint room_allocations_monthly_fee_amount_chk check (monthly_fee_amount >= 0)
);

comment on table public.room_allocations is 'Room assignment history. Active records represent current occupancy.';

-- ---------------------------------------------------------------------------
-- Finance: fees, invoices, payments, and Cashfree webhook tracking
-- ---------------------------------------------------------------------------

create table public.monthly_fee_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid not null references public.residents(id) on delete restrict,
  room_allocation_id uuid references public.room_allocations(id) on delete set null,
  period_month date not null,
  due_date date not null,
  base_amount numeric(12,2) not null default 0,
  advance_adjustment_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  penalty_amount numeric(12,2) not null default 0,
  adjustment_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  balance_amount numeric(12,2) not null default 0,
  status public.fee_record_status_enum not null default 'pending',
  generated_at timestamptz not null default now(),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint monthly_fee_period_first_day_chk check (period_month = date_trunc('month', period_month)::date),
  constraint monthly_fee_amounts_nonnegative_chk check (
    base_amount >= 0
    and advance_adjustment_amount >= 0
    and discount_amount >= 0
    and penalty_amount >= 0
    and total_amount >= 0
    and paid_amount >= 0
    and balance_amount >= 0
  ),
  constraint monthly_fee_paid_not_over_total_chk check (paid_amount <= total_amount)
);

comment on table public.monthly_fee_records is 'Monthly resident dues and balance lifecycle. Do not hard delete once invoiced or paid.';

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid not null references public.residents(id) on delete restrict,
  monthly_fee_record_id uuid references public.monthly_fee_records(id) on delete set null,
  invoice_number text not null,
  status public.invoice_status_enum not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  balance_amount numeric(12,2) not null default 0,
  pdf_document_id uuid,
  pdf_storage_path text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users(id) on delete set null,
  cancellation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint invoices_amounts_nonnegative_chk check (
    subtotal_amount >= 0
    and discount_amount >= 0
    and tax_amount >= 0
    and total_amount >= 0
    and paid_amount >= 0
    and balance_amount >= 0
  ),
  constraint invoices_paid_not_over_total_chk check (paid_amount <= total_amount),
  constraint invoices_cancel_reason_chk check (status <> 'cancelled' or cancellation_reason is not null)
);

comment on table public.invoices is 'Invoice headers with PDF references. Issued invoices should be cancelled, not deleted.';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid not null references public.residents(id) on delete restrict,
  monthly_fee_record_id uuid references public.monthly_fee_records(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(12,2) not null,
  method public.payment_method_enum not null,
  status public.payment_status_enum not null default 'initiated',
  transaction_id text,
  provider text,
  provider_reference text,
  cashfree_order_id text,
  cashfree_payment_id text,
  manual_reference text,
  is_partial boolean not null default false,
  is_advance boolean not null default false,
  received_by uuid references public.users(id) on delete set null,
  verified_by uuid references public.users(id) on delete set null,
  paid_at timestamptz,
  verified_at timestamptz,
  failure_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint payments_amount_positive_chk check (amount > 0)
);

comment on table public.payments is 'Internal payment source of truth for cash, online, partial, and advance payments.';

-- ---------------------------------------------------------------------------
-- Leave management
-- ---------------------------------------------------------------------------

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid not null references public.residents(id) on delete restrict,
  from_date date not null,
  to_date date not null,
  reason text not null,
  destination text,
  travel_mode text,
  parent_notified_at timestamptz,
  status public.leave_status_enum not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  departed_at timestamptz,
  returned_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint leave_requests_dates_chk check (to_date >= from_date),
  constraint leave_requests_rejection_reason_chk check (status <> 'rejected' or rejection_reason is not null)
);

comment on table public.leave_requests is 'Resident leave workflow with approval, rejection, parent notification, departure, and return tracking.';

-- ---------------------------------------------------------------------------
-- CMS and communication
-- ---------------------------------------------------------------------------

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  title text not null,
  body text not null,
  status public.cms_status_enum not null default 'draft',
  audience_type text not null default 'all',
  audience_filter jsonb not null default '{}'::jsonb,
  is_pinned boolean not null default false,
  published_at timestamptz,
  published_by uuid references public.users(id) on delete set null,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint notices_audience_type_chk check (audience_type in ('all', 'hostel', 'room', 'residents', 'roles'))
);

comment on table public.notices is 'Admin-published notices and announcements for resident audiences.';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  recipient_user_id uuid references public.users(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete cascade,
  notice_id uuid references public.notices(id) on delete set null,
  channel public.notification_channel_enum not null default 'in_app',
  status public.notification_status_enum not null default 'queued',
  title text not null,
  body text not null,
  template_key text,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint notifications_recipient_chk check (recipient_user_id is not null or resident_id is not null)
);

comment on table public.notifications is 'In-app and external-channel notification records.';

-- ---------------------------------------------------------------------------
-- Documents and storage metadata
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  uploaded_by_user_id uuid references public.users(id) on delete set null,
  document_type public.document_type_enum not null,
  status public.document_status_enum not null default 'pending',
  bucket_name text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  checksum text,
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  rejection_reason text,
  is_public boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint documents_file_size_chk check (file_size_bytes > 0),
  constraint documents_rejection_reason_chk check (status <> 'rejected' or rejection_reason is not null)
);

comment on table public.documents is 'Secure file metadata for Aadhaar uploads, invoices, resident files, gallery images, and support attachments.';

alter table public.users
  add constraint users_avatar_document_fkey foreign key (avatar_document_id) references public.documents(id) on delete set null;

alter table public.residents
  add constraint residents_aadhaar_document_fkey foreign key (aadhaar_document_id) references public.documents(id) on delete set null,
  add constraint residents_profile_image_document_fkey foreign key (profile_image_document_id) references public.documents(id) on delete set null;

alter table public.invoices
  add constraint invoices_pdf_document_fkey foreign key (pdf_document_id) references public.documents(id) on delete set null;

create table public.gallery (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  title text not null,
  description text,
  alt_text text,
  category text not null default 'general',
  sort_order integer not null default 0,
  status public.cms_status_enum not null default 'draft',
  published_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

comment on table public.gallery is 'CMS-managed public image gallery backed by documents/storage.';

create table public.website_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  section_key text not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  status public.cms_status_enum not null default 'draft',
  seo_title text,
  seo_description text,
  published_at timestamptz,
  published_by uuid references public.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

comment on table public.website_settings is 'Dynamic CMS settings for homepage, pricing, SEO, terms, and contact details.';

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  name text not null,
  slug citext not null,
  description text,
  icon_name text,
  image_document_id uuid references public.documents(id) on delete set null,
  is_highlighted boolean not null default false,
  sort_order integer not null default 0,
  status public.cms_status_enum not null default 'draft',
  published_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

comment on table public.facilities is 'CMS-managed hostel facilities for public pages and admin editing.';

-- ---------------------------------------------------------------------------
-- Audit, webhooks, notification logs, and support
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  hostel_id uuid references public.hostels(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null
);

comment on table public.audit_logs is 'Audit log for table changes, financial events, role changes, and admin activity. Avoid hard deletes.';

create table public.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  hostel_id uuid references public.hostels(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null default 'cashfree',
  event_id text,
  event_type text not null,
  transaction_id text,
  cashfree_order_id text,
  cashfree_payment_id text,
  signature_valid boolean not null default false,
  processing_status text not null default 'received',
  received_payload jsonb not null,
  headers jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint payment_webhooks_processing_status_chk check (processing_status in ('received', 'processed', 'ignored', 'failed'))
);

comment on table public.payment_webhooks is 'Cashfree webhook event store for idempotency, reconciliation, and debugging.';

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel public.notification_channel_enum not null,
  provider text,
  provider_message_id text,
  status public.notification_status_enum not null,
  attempt_number integer not null default 1,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint notification_logs_attempt_number_chk check (attempt_number > 0)
);

comment on table public.notification_logs is 'Delivery attempts and provider responses for email, SMS, WhatsApp, and in-app notifications.';

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid references public.residents(id) on delete set null,
  created_by_user_id uuid references public.users(id) on delete set null,
  assigned_to_user_id uuid references public.users(id) on delete set null,
  category text not null default 'general',
  priority public.support_priority_enum not null default 'medium',
  status public.support_status_enum not null default 'open',
  subject text not null,
  description text not null,
  resolution_notes text,
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

comment on table public.support_requests is 'Resident support/help tickets for maintenance, payments, leave, and general requests.';

-- ---------------------------------------------------------------------------
-- Unique constraints and indexes
-- ---------------------------------------------------------------------------

create unique index organizations_slug_uidx
  on public.organizations (slug)
  where deleted_at is null;

create index organizations_created_at_idx on public.organizations (created_at desc);
create index organizations_active_idx on public.organizations (is_active) where deleted_at is null;

create unique index users_email_uidx
  on public.users (email)
  where email is not null and deleted_at is null;

create index users_organization_id_idx on public.users (organization_id);
create index users_phone_idx on public.users (phone);
create index users_created_at_idx on public.users (created_at desc);
create index users_active_idx on public.users (is_active) where deleted_at is null;

create unique index hostels_org_code_uidx
  on public.hostels (organization_id, code)
  where deleted_at is null;

create unique index hostels_org_slug_uidx
  on public.hostels (organization_id, slug)
  where deleted_at is null;

create index hostels_organization_id_idx on public.hostels (organization_id);
create index hostels_created_at_idx on public.hostels (created_at desc);
create index hostels_active_idx on public.hostels (organization_id, is_active);

create unique index user_roles_unique_active_uidx
  on public.user_roles (
    organization_id,
    coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    user_id,
    role
  )
  where deleted_at is null;

create index user_roles_organization_id_idx on public.user_roles (organization_id);
create index user_roles_hostel_id_idx on public.user_roles (hostel_id);
create index user_roles_user_id_idx on public.user_roles (user_id, status);
create index user_roles_role_idx on public.user_roles (organization_id, role, status);
create index user_roles_created_at_idx on public.user_roles (created_at desc);

create unique index residents_admission_uidx
  on public.residents (hostel_id, admission_number)
  where deleted_at is null;

create unique index residents_user_uidx
  on public.residents (user_id)
  where user_id is not null and deleted_at is null;

create index residents_organization_id_idx on public.residents (organization_id);
create index residents_hostel_status_idx on public.residents (hostel_id, status);
create index residents_phone_idx on public.residents (phone);
create index residents_email_idx on public.residents (email);
create index residents_parent_phone_idx on public.residents (parent_phone);
create index residents_created_at_idx on public.residents (created_at desc);
create index residents_name_search_idx on public.residents using gin (to_tsvector('simple', full_name));

create unique index rooms_hostel_room_number_uidx
  on public.rooms (hostel_id, room_number)
  where deleted_at is null;

create index rooms_organization_id_idx on public.rooms (organization_id);
create index rooms_hostel_status_idx on public.rooms (hostel_id, status);
create index rooms_room_type_idx on public.rooms (organization_id, hostel_id, room_type);
create index rooms_created_at_idx on public.rooms (created_at desc);

create unique index room_allocations_one_active_resident_uidx
  on public.room_allocations (resident_id)
  where status = 'active' and deleted_at is null;

create index room_allocations_organization_id_idx on public.room_allocations (organization_id);
create index room_allocations_resident_id_idx on public.room_allocations (resident_id);
create index room_allocations_room_id_idx on public.room_allocations (room_id, status);
create index room_allocations_hostel_status_idx on public.room_allocations (hostel_id, status);
create index room_allocations_created_at_idx on public.room_allocations (created_at desc);

create unique index monthly_fee_unique_period_uidx
  on public.monthly_fee_records (resident_id, period_month)
  where deleted_at is null;

create index monthly_fee_organization_id_idx on public.monthly_fee_records (organization_id);
create index monthly_fee_resident_id_idx on public.monthly_fee_records (resident_id);
create index monthly_fee_hostel_period_status_idx on public.monthly_fee_records (hostel_id, period_month, status);
create index monthly_fee_due_date_idx on public.monthly_fee_records (due_date);
create index monthly_fee_created_at_idx on public.monthly_fee_records (created_at desc);

create unique index invoices_org_number_uidx
  on public.invoices (organization_id, invoice_number)
  where deleted_at is null;

create index invoices_organization_id_idx on public.invoices (organization_id);
create index invoices_resident_id_idx on public.invoices (resident_id);
create index invoices_hostel_status_idx on public.invoices (hostel_id, status);
create index invoices_due_date_idx on public.invoices (due_date);
create index invoices_created_at_idx on public.invoices (created_at desc);

create index payments_organization_id_idx on public.payments (organization_id);
create index payments_resident_id_idx on public.payments (resident_id);
create index payments_invoice_id_idx on public.payments (invoice_id);
create index payments_monthly_fee_record_id_idx on public.payments (monthly_fee_record_id);
create index payments_status_idx on public.payments (status);
create index payments_method_idx on public.payments (method);
create index payments_transaction_id_idx on public.payments (transaction_id);
create index payments_paid_at_idx on public.payments (paid_at desc);
create index payments_created_at_idx on public.payments (created_at desc);

create unique index payments_cashfree_order_uidx
  on public.payments (cashfree_order_id)
  where cashfree_order_id is not null;

create unique index payments_cashfree_payment_uidx
  on public.payments (cashfree_payment_id)
  where cashfree_payment_id is not null;

create index leave_requests_organization_id_idx on public.leave_requests (organization_id);
create index leave_requests_resident_id_idx on public.leave_requests (resident_id);
create index leave_requests_status_idx on public.leave_requests (status);
create index leave_requests_hostel_status_date_idx on public.leave_requests (hostel_id, status, from_date);
create index leave_requests_created_at_idx on public.leave_requests (created_at desc);

create index notices_organization_id_idx on public.notices (organization_id);
create index notices_hostel_status_idx on public.notices (hostel_id, status, published_at desc);
create index notices_created_at_idx on public.notices (created_at desc);
create index notices_audience_gin_idx on public.notices using gin (audience_filter);

create index notifications_organization_id_idx on public.notifications (organization_id);
create index notifications_recipient_user_idx on public.notifications (recipient_user_id, status, created_at desc);
create index notifications_resident_idx on public.notifications (resident_id, status, created_at desc);
create index notifications_status_idx on public.notifications (status);
create index notifications_scheduled_idx on public.notifications (scheduled_for) where status = 'queued';
create index notifications_created_at_idx on public.notifications (created_at desc);

create unique index documents_storage_path_uidx
  on public.documents (bucket_name, storage_path)
  where deleted_at is null;

create index documents_organization_id_idx on public.documents (organization_id);
create index documents_resident_id_idx on public.documents (resident_id);
create index documents_invoice_id_idx on public.documents (invoice_id);
create index documents_status_idx on public.documents (status);
create index documents_type_idx on public.documents (document_type);
create index documents_created_at_idx on public.documents (created_at desc);

create index gallery_organization_id_idx on public.gallery (organization_id);
create index gallery_hostel_status_idx on public.gallery (hostel_id, status, sort_order);
create index gallery_category_idx on public.gallery (organization_id, category, status);
create index gallery_created_at_idx on public.gallery (created_at desc);

create unique index website_settings_section_uidx
  on public.website_settings (
    organization_id,
    coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    section_key
  )
  where deleted_at is null;

create index website_settings_organization_id_idx on public.website_settings (organization_id);
create index website_settings_hostel_status_idx on public.website_settings (hostel_id, status);
create index website_settings_content_gin_idx on public.website_settings using gin (content);
create index website_settings_created_at_idx on public.website_settings (created_at desc);

create unique index facilities_slug_uidx
  on public.facilities (
    organization_id,
    coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    slug
  )
  where deleted_at is null;

create index facilities_organization_id_idx on public.facilities (organization_id);
create index facilities_hostel_status_idx on public.facilities (hostel_id, status, sort_order);
create index facilities_created_at_idx on public.facilities (created_at desc);

create index audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index audit_logs_entity_idx on public.audit_logs (table_name, record_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create unique index payment_webhooks_provider_event_uidx
  on public.payment_webhooks (provider, event_id)
  where event_id is not null;

create index payment_webhooks_organization_id_idx on public.payment_webhooks (organization_id);
create index payment_webhooks_payment_id_idx on public.payment_webhooks (payment_id);
create index payment_webhooks_transaction_id_idx on public.payment_webhooks (transaction_id);
create index payment_webhooks_cashfree_order_idx on public.payment_webhooks (cashfree_order_id);
create index payment_webhooks_processing_status_idx on public.payment_webhooks (processing_status, created_at desc);
create index payment_webhooks_created_at_idx on public.payment_webhooks (created_at desc);

create index notification_logs_organization_id_idx on public.notification_logs (organization_id);
create index notification_logs_notification_id_idx on public.notification_logs (notification_id, created_at desc);
create index notification_logs_status_idx on public.notification_logs (status);
create index notification_logs_provider_message_idx on public.notification_logs (provider, provider_message_id);
create index notification_logs_created_at_idx on public.notification_logs (created_at desc);

create index support_requests_organization_id_idx on public.support_requests (organization_id);
create index support_requests_resident_id_idx on public.support_requests (resident_id);
create index support_requests_assigned_to_idx on public.support_requests (assigned_to_user_id, status);
create index support_requests_status_idx on public.support_requests (status);
create index support_requests_hostel_status_idx on public.support_requests (hostel_id, status, priority);
create index support_requests_created_at_idx on public.support_requests (created_at desc);

-- ---------------------------------------------------------------------------
-- Reporting views
-- ---------------------------------------------------------------------------

create view public.room_occupancy_view as
select
  r.organization_id,
  r.hostel_id,
  r.id as room_id,
  r.room_number,
  r.capacity,
  count(ra.id) filter (
    where ra.status = 'active'
      and ra.deleted_at is null
  )::integer as occupied_count,
  (
    r.capacity - count(ra.id) filter (
      where ra.status = 'active'
        and ra.deleted_at is null
    )
  )::integer as available_count
from public.rooms r
left join public.room_allocations ra on ra.room_id = r.id
where r.deleted_at is null
group by r.organization_id, r.hostel_id, r.id, r.room_number, r.capacity;

create view public.resident_balance_view as
select
  organization_id,
  hostel_id,
  resident_id,
  sum(balance_amount)::numeric(12,2) as total_due
from public.monthly_fee_records
where deleted_at is null
  and status in ('pending', 'partial', 'overdue')
group by organization_id, hostel_id, resident_id;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'users',
    'hostels',
    'user_roles',
    'residents',
    'rooms',
    'room_allocations',
    'monthly_fee_records',
    'invoices',
    'payments',
    'leave_requests',
    'notices',
    'notifications',
    'documents',
    'gallery',
    'website_settings',
    'facilities',
    'audit_logs',
    'payment_webhooks',
    'notification_logs',
    'support_requests'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS preparation
-- Policies should be added in a follow-up migration after auth flows are wired.
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.hostels enable row level security;
alter table public.user_roles enable row level security;
alter table public.residents enable row level security;
alter table public.rooms enable row level security;
alter table public.room_allocations enable row level security;
alter table public.monthly_fee_records enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.leave_requests enable row level security;
alter table public.notices enable row level security;
alter table public.notifications enable row level security;
alter table public.documents enable row level security;
alter table public.gallery enable row level security;
alter table public.website_settings enable row level security;
alter table public.facilities enable row level security;
alter table public.audit_logs enable row level security;
alter table public.payment_webhooks enable row level security;
alter table public.notification_logs enable row level security;
alter table public.support_requests enable row level security;

commit;
