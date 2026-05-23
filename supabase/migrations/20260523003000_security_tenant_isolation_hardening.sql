-- Final tenant-isolation hardening.
-- Adds finance-role RLS support, force-RLS on later operational tables,
-- tenant-scoped document/payment invariants, and security-invoker views.

begin;

-- Finance staff were added after the original RLS helpers. Keep database RLS
-- aligned with the application FINANCE_ROLES constant so finance users can
-- perform only finance-scoped operations without becoming broad admins.
create or replace function public.can_manage_finance(org_id uuid, hostel_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.has_role_in_organization(
      org_id,
      array['owner', 'admin', 'finance']::public.user_role_enum[],
      hostel_id
    );
$$;

comment on function public.can_manage_finance(uuid, uuid) is
  'Returns true for super admins, owners, admins, and finance users scoped to the requested tenant/hostel.';

-- Later operational tables must be held to the same RLS standard as the
-- foundation tables.
alter table if exists public.hostel_capacity enable row level security;
alter table if exists public.hostel_capacity force row level security;
alter table if exists public.room_capacity enable row level security;
alter table if exists public.room_capacity force row level security;
alter table if exists public.leads enable row level security;
alter table if exists public.leads force row level security;
alter table if exists public.lead_notes enable row level security;
alter table if exists public.lead_notes force row level security;
alter table if exists public.lead_activity_logs enable row level security;
alter table if exists public.lead_activity_logs force row level security;
alter table if exists public.reservations enable row level security;
alter table if exists public.reservations force row level security;
alter table if exists public.reservation_payments enable row level security;
alter table if exists public.reservation_payments force row level security;
alter table if exists public.resident_invites enable row level security;
alter table if exists public.resident_invites force row level security;
alter table if exists public.payment_settings enable row level security;
alter table if exists public.payment_settings force row level security;

-- Keep public views under invoker privileges so RLS remains effective even if
-- ownership changes later.
alter view if exists public.resident_balance_view set (security_invoker = true);
alter view if exists public.room_occupancy_view set (security_invoker = true);
alter view if exists public.room_vacancy_view set (security_invoker = true);
alter view if exists public.hostel_vacancy_view set (security_invoker = true);
alter view if exists public.occupancy_anomalies_view set (security_invoker = true);

-- New rows must use tenant-prefixed paths. NOT VALID avoids blocking migration
-- replay on legacy rows, but PostgreSQL still enforces these constraints for
-- future inserts/updates.
alter table public.documents
  drop constraint if exists documents_storage_path_tenant_prefix_chk,
  add constraint documents_storage_path_tenant_prefix_chk
    check (storage_path like organization_id::text || '/%') not valid;

alter table public.documents
  drop constraint if exists documents_private_bucket_public_chk,
  add constraint documents_private_bucket_public_chk
    check (bucket_name = 'gallery-images' or is_public is false) not valid;

alter table public.documents
  drop constraint if exists documents_payment_receipt_scope_chk,
  add constraint documents_payment_receipt_scope_chk
    check (
      document_type <> 'payment_receipt'::public.document_type_enum
      or (
        bucket_name = 'payment-screenshots'
        and resident_id is not null
        and payment_id is not null
        and is_public is false
      )
    ) not valid;

alter table public.documents
  drop constraint if exists documents_invoice_pdf_scope_chk,
  add constraint documents_invoice_pdf_scope_chk
    check (
      document_type <> 'invoice_pdf'::public.document_type_enum
      or (
        bucket_name = 'invoices'
        and resident_id is not null
        and invoice_id is not null
        and is_public is false
      )
    ) not valid;

create or replace function public.validate_document_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.storage_path not like new.organization_id::text || '/%' then
    raise exception 'document_storage_path_must_start_with_organization';
  end if;

  if new.bucket_name <> 'gallery-images' and new.is_public is true then
    raise exception 'private_document_cannot_be_public';
  end if;

  if new.resident_id is not null and not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and (new.hostel_id is null or r.hostel_id = new.hostel_id)
      and r.deleted_at is null
  ) then
    raise exception 'document_resident_tenant_mismatch';
  end if;

  if new.payment_id is not null and not exists (
    select 1
    from public.payments p
    where p.id = new.payment_id
      and p.organization_id = new.organization_id
      and (new.hostel_id is null or p.hostel_id = new.hostel_id)
      and (new.resident_id is null or p.resident_id = new.resident_id)
      and p.deleted_at is null
  ) then
    raise exception 'document_payment_tenant_mismatch';
  end if;

  if new.invoice_id is not null and not exists (
    select 1
    from public.invoices i
    where i.id = new.invoice_id
      and i.organization_id = new.organization_id
      and (new.hostel_id is null or i.hostel_id = new.hostel_id)
      and (new.resident_id is null or i.resident_id = new.resident_id)
      and i.deleted_at is null
  ) then
    raise exception 'document_invoice_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_documents_tenant_scope on public.documents;
create trigger validate_documents_tenant_scope
before insert or update on public.documents
for each row
execute function public.validate_document_tenant_scope();

create or replace function public.validate_payment_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
      and r.deleted_at is null
  ) then
    raise exception 'payment_resident_tenant_mismatch';
  end if;

  if new.monthly_fee_record_id is not null and not exists (
    select 1
    from public.monthly_fee_records mfr
    where mfr.id = new.monthly_fee_record_id
      and mfr.organization_id = new.organization_id
      and mfr.hostel_id = new.hostel_id
      and mfr.resident_id = new.resident_id
      and mfr.deleted_at is null
  ) then
    raise exception 'payment_fee_record_tenant_mismatch';
  end if;

  if new.invoice_id is not null and not exists (
    select 1
    from public.invoices i
    where i.id = new.invoice_id
      and i.organization_id = new.organization_id
      and i.hostel_id = new.hostel_id
      and i.resident_id = new.resident_id
      and i.deleted_at is null
  ) then
    raise exception 'payment_invoice_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_payments_tenant_scope on public.payments;
create trigger validate_payments_tenant_scope
before insert or update on public.payments
for each row
execute function public.validate_payment_tenant_scope();

create or replace function public.validate_resident_invite_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
      and r.deleted_at is null
  ) then
    raise exception 'resident_invite_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_resident_invites_tenant_scope on public.resident_invites;
create trigger validate_resident_invites_tenant_scope
before insert or update on public.resident_invites
for each row
execute function public.validate_resident_invite_tenant_scope();

create or replace function public.validate_reservation_payment_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.reservations r
    where r.id = new.reservation_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
      and r.lead_id = new.lead_id
      and r.deleted_at is null
  ) then
    raise exception 'reservation_payment_reservation_tenant_mismatch';
  end if;

  if not exists (
    select 1
    from public.leads l
    where l.id = new.lead_id
      and l.organization_id = new.organization_id
      and (l.hostel_id is null or l.hostel_id = new.hostel_id)
      and l.deleted_at is null
  ) then
    raise exception 'reservation_payment_lead_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reservation_payments_tenant_scope on public.reservation_payments;
create trigger validate_reservation_payments_tenant_scope
before insert or update on public.reservation_payments
for each row
execute function public.validate_reservation_payment_tenant_scope();

-- A lightweight database-side security anomaly view for operational audits.
-- Application scanners add richer tenant-aware reporting and audit persistence.
create or replace view public.security_anomalies_view
with (security_invoker = true)
as
select
  d.organization_id,
  d.hostel_id,
  d.id as record_id,
  'documents'::text as table_name,
  case
    when d.storage_path not like d.organization_id::text || '/%' then 'storage_path_not_tenant_prefixed'
    when d.bucket_name <> 'gallery-images' and d.is_public is true then 'private_document_marked_public'
    when d.document_type = 'payment_receipt'::public.document_type_enum and d.payment_id is null then 'payment_proof_missing_payment'
    when d.document_type = 'invoice_pdf'::public.document_type_enum and d.invoice_id is null then 'invoice_pdf_missing_invoice'
    else 'document_scope_review'
  end as anomaly_type,
  d.created_at
from public.documents d
where d.deleted_at is null
  and (
    d.storage_path not like d.organization_id::text || '/%'
    or (d.bucket_name <> 'gallery-images' and d.is_public is true)
    or (d.document_type = 'payment_receipt'::public.document_type_enum and d.payment_id is null)
    or (d.document_type = 'invoice_pdf'::public.document_type_enum and d.invoice_id is null)
  )
union all
select
  p.organization_id,
  p.hostel_id,
  p.id as record_id,
  'payments'::text as table_name,
  'payment_resident_tenant_mismatch'::text as anomaly_type,
  p.created_at
from public.payments p
left join public.residents r
  on r.id = p.resident_id
  and r.organization_id = p.organization_id
  and r.hostel_id = p.hostel_id
  and r.deleted_at is null
where p.deleted_at is null
  and r.id is null
union all
select
  i.organization_id,
  i.hostel_id,
  i.id as record_id,
  'resident_invites'::text as table_name,
  'invite_resident_tenant_mismatch'::text as anomaly_type,
  i.created_at
from public.resident_invites i
left join public.residents r
  on r.id = i.resident_id
  and r.organization_id = i.organization_id
  and r.hostel_id = i.hostel_id
  and r.deleted_at is null
where r.id is null;

grant select on public.security_anomalies_view to authenticated, service_role;

commit;
