-- Manual UPI payment operations: hostel payment accounts, QR storage,
-- duplicate UTR/proof protection, and finance-safe rejection flow.

begin;

-- ---------------------------------------------------------------------------
-- Payment account settings
-- ---------------------------------------------------------------------------

create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  payment_method public.payment_method_enum not null default 'upi',
  account_name text not null,
  upi_id text,
  qr_image_path text,
  bank_name text,
  branch_name text,
  account_last4 text,
  is_active boolean not null default true,
  supports_manual_verification boolean not null default true,
  instructions text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint payment_settings_supported_method_chk check (
    payment_method in ('upi', 'bank_transfer', 'cash')
  ),
  constraint payment_settings_upi_details_chk check (
    payment_method <> 'upi'
    or (
      nullif(trim(coalesce(upi_id, '')), '') is not null
      or nullif(trim(coalesce(qr_image_path, '')), '') is not null
    )
  ),
  constraint payment_settings_account_last4_chk check (
    account_last4 is null or account_last4 ~ '^[0-9]{4}$'
  )
);

comment on table public.payment_settings is
  'Tenant-scoped hostel payment account configuration for manual UPI, bank transfer, and cash workflows.';

drop trigger if exists set_payment_settings_updated_at on public.payment_settings;
create trigger set_payment_settings_updated_at
before update on public.payment_settings
for each row execute function public.set_updated_at();

create index if not exists payment_settings_organization_id_idx
  on public.payment_settings (organization_id)
  where deleted_at is null;

create index if not exists payment_settings_hostel_active_idx
  on public.payment_settings (organization_id, hostel_id, is_active)
  where deleted_at is null;

create unique index if not exists payment_settings_one_active_per_hostel_uidx
  on public.payment_settings (organization_id, hostel_id)
  where is_active = true and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Manual UPI duplicate protection
-- ---------------------------------------------------------------------------

create unique index if not exists payments_upi_transaction_reference_uidx
  on public.payments (organization_id, lower(transaction_id))
  where method = 'upi'
    and transaction_id is not null
    and deleted_at is null
    and status in ('initiated', 'pending', 'verified');

create unique index if not exists documents_active_payment_proof_uidx
  on public.documents (organization_id, payment_id)
  where document_type = 'payment_receipt'
    and payment_id is not null
    and status <> 'rejected'
    and deleted_at is null;

create unique index if not exists documents_payment_proof_checksum_uidx
  on public.documents (organization_id, checksum)
  where document_type = 'payment_receipt'
    and checksum is not null
    and status <> 'rejected'
    and deleted_at is null;

create index if not exists monthly_fee_records_resident_balance_idx
  on public.monthly_fee_records (organization_id, resident_id, status, due_date)
  where deleted_at is null and balance_amount > 0;

-- ---------------------------------------------------------------------------
-- Storage bucket for private hostel payment QR images
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-qr-codes',
  'payment-qr-codes',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_admin_manage_payment_qr_codes" on storage.objects;
create policy "storage_admin_manage_payment_qr_codes"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'payment-qr-codes'
  and public.can_manage_finance(public.storage_object_organization_id(name))
)
with check (
  bucket_id = 'payment-qr-codes'
  and public.can_manage_finance(public.storage_object_organization_id(name))
);

drop policy if exists "storage_tenant_read_payment_qr_codes" on storage.objects;
create policy "storage_tenant_read_payment_qr_codes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-qr-codes'
  and public.belongs_to_organization(public.storage_object_organization_id(name))
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.payment_settings enable row level security;
alter table public.payment_settings force row level security;

drop policy if exists "payment_settings_select_tenant" on public.payment_settings;
create policy "payment_settings_select_tenant"
on public.payment_settings
for select
to authenticated
using (public.belongs_to_organization(organization_id));

drop policy if exists "payment_settings_insert_finance_admin" on public.payment_settings;
create policy "payment_settings_insert_finance_admin"
on public.payment_settings
for insert
to authenticated
with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists "payment_settings_update_finance_admin" on public.payment_settings;
create policy "payment_settings_update_finance_admin"
on public.payment_settings
for update
to authenticated
using (public.can_manage_finance(organization_id, hostel_id))
with check (public.can_manage_finance(organization_id, hostel_id));

-- ---------------------------------------------------------------------------
-- Finance-safe settings upsert
-- ---------------------------------------------------------------------------

create or replace function public.upsert_payment_setting_atomic(
  p_id uuid,
  p_organization_id uuid,
  p_hostel_id uuid,
  p_payment_method public.payment_method_enum,
  p_account_name text,
  p_upi_id text default null,
  p_qr_image_path text default null,
  p_bank_name text default null,
  p_branch_name text default null,
  p_account_last4 text default null,
  p_is_active boolean default true,
  p_supports_manual_verification boolean default true,
  p_instructions text default null,
  p_actor_user_id uuid default auth.uid()
)
returns public.payment_settings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_setting public.payment_settings;
begin
  if p_actor_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.can_manage_finance(p_organization_id, p_hostel_id) then
    raise exception 'payment_settings_forbidden' using errcode = '42501';
  end if;

  if p_payment_method not in ('upi', 'bank_transfer', 'cash') then
    raise exception 'unsupported_payment_method' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_account_name, '')), '') is null then
    raise exception 'account_name_required' using errcode = '23514';
  end if;

  if p_payment_method = 'upi'
     and nullif(trim(coalesce(p_upi_id, '')), '') is null
     and nullif(trim(coalesce(p_qr_image_path, '')), '') is null then
    raise exception 'upi_id_or_qr_required' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':payment-settings:' || p_hostel_id::text, 0)
  );

  if p_is_active then
    update public.payment_settings
    set
      is_active = false,
      updated_by = p_actor_user_id,
      updated_at = now()
    where organization_id = p_organization_id
      and hostel_id = p_hostel_id
      and is_active = true
      and deleted_at is null
      and (p_id is null or id <> p_id);
  end if;

  if p_id is not null then
    update public.payment_settings
    set
      payment_method = p_payment_method,
      account_name = trim(p_account_name),
      upi_id = nullif(trim(coalesce(p_upi_id, '')), ''),
      qr_image_path = nullif(trim(coalesce(p_qr_image_path, '')), ''),
      bank_name = nullif(trim(coalesce(p_bank_name, '')), ''),
      branch_name = nullif(trim(coalesce(p_branch_name, '')), ''),
      account_last4 = nullif(trim(coalesce(p_account_last4, '')), ''),
      is_active = p_is_active,
      supports_manual_verification = p_supports_manual_verification,
      instructions = nullif(trim(coalesce(p_instructions, '')), ''),
      updated_by = p_actor_user_id
    where id = p_id
      and organization_id = p_organization_id
      and hostel_id = p_hostel_id
      and deleted_at is null
    returning * into v_setting;

    if found then
      return v_setting;
    end if;
  end if;

  insert into public.payment_settings (
    organization_id,
    hostel_id,
    payment_method,
    account_name,
    upi_id,
    qr_image_path,
    bank_name,
    branch_name,
    account_last4,
    is_active,
    supports_manual_verification,
    instructions,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_payment_method,
    trim(p_account_name),
    nullif(trim(coalesce(p_upi_id, '')), ''),
    nullif(trim(coalesce(p_qr_image_path, '')), ''),
    nullif(trim(coalesce(p_bank_name, '')), ''),
    nullif(trim(coalesce(p_branch_name, '')), ''),
    nullif(trim(coalesce(p_account_last4, '')), ''),
    p_is_active,
    p_supports_manual_verification,
    nullif(trim(coalesce(p_instructions, '')), ''),
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_setting;

  return v_setting;
end;
$$;

grant execute on function public.upsert_payment_setting_atomic(
  uuid, uuid, uuid, public.payment_method_enum, text, text, text, text, text, text, boolean, boolean, text, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Finance-safe payment rejection
-- ---------------------------------------------------------------------------

create or replace function public.reject_payment_atomic(
  p_payment_id uuid,
  p_organization_id uuid,
  p_reviewer_user_id uuid,
  p_reason text
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  if p_reviewer_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'rejection_reason_required' using errcode = '23514';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if not public.can_manage_finance(v_payment.organization_id, v_payment.hostel_id) then
    raise exception 'payment_rejection_forbidden' using errcode = '42501';
  end if;

  if v_payment.status = 'verified' then
    raise exception 'verified_payment_is_immutable' using errcode = '23505';
  end if;

  if v_payment.status not in ('initiated', 'pending') then
    raise exception 'payment_status_not_rejectable' using errcode = '23514';
  end if;

  update public.payments
  set
    status = 'failed'::public.payment_status_enum,
    failure_reason = trim(p_reason),
    verified_by = p_reviewer_user_id,
    verified_at = now(),
    updated_by = p_reviewer_user_id,
    lock_version = lock_version + 1,
    metadata = metadata || jsonb_build_object(
      'manual_rejection_reason', trim(p_reason),
      'rejected_at', now()
    )
  where id = p_payment_id
    and organization_id = p_organization_id
  returning * into v_payment;

  update public.documents
  set
    status = 'rejected'::public.document_status_enum,
    rejection_reason = trim(p_reason),
    updated_by = p_reviewer_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and payment_id = p_payment_id
    and document_type = 'payment_receipt'::public.document_type_enum
    and deleted_at is null
    and status <> 'rejected'::public.document_status_enum;

  return v_payment;
end;
$$;

revoke execute on function public.reject_payment_atomic(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.reject_payment_atomic(uuid, uuid, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Harden draft creation validation without changing the existing workflow.
-- ---------------------------------------------------------------------------

create or replace function public.create_resident_upi_payment_draft(
  p_organization_id uuid,
  p_hostel_id uuid,
  p_resident_id uuid,
  p_monthly_fee_record_id uuid,
  p_amount numeric,
  p_transaction_id text,
  p_idempotency_key text,
  p_notes text default null,
  p_is_advance boolean default false,
  p_is_partial boolean default false,
  p_actor_user_id uuid default auth.uid()
)
returns public.payments
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_existing public.payments;
  v_resident public.residents;
  v_fee_record public.monthly_fee_records;
  v_payment public.payments;
  v_transaction_id text := upper(trim(coalesce(p_transaction_id, '')));
begin
  if p_actor_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if p_amount <= 0 then
    raise exception 'payment_amount_must_be_positive' using errcode = '23514';
  end if;

  if v_transaction_id is null or v_transaction_id = '' then
    raise exception 'transaction_reference_required' using errcode = '23514';
  end if;

  if v_transaction_id !~ '^[A-Z0-9][A-Z0-9._/-]{5,63}$' then
    raise exception 'invalid_transaction_reference_format' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'idempotency_key_required' using errcode = '23514';
  end if;

  select *
  into v_existing
  from public.payments
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key
    and deleted_at is null
  for update;

  if found then
    return v_existing;
  end if;

  if exists (
    select 1
    from public.payments
    where organization_id = p_organization_id
      and lower(transaction_id) = lower(v_transaction_id)
      and method = 'upi'::public.payment_method_enum
      and status in ('initiated', 'pending', 'verified')
      and deleted_at is null
  ) then
    raise exception 'duplicate_transaction_reference' using errcode = '23505';
  end if;

  select *
  into v_resident
  from public.residents
  where id = p_resident_id
    and organization_id = p_organization_id
    and hostel_id = p_hostel_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'resident_not_found' using errcode = 'P0002';
  end if;

  if not (
    public.can_manage_finance(p_organization_id, p_hostel_id)
    or public.owns_resident(p_resident_id)
  ) then
    raise exception 'payment_submission_forbidden' using errcode = '42501';
  end if;

  if p_monthly_fee_record_id is not null then
    select *
    into v_fee_record
    from public.monthly_fee_records
    where id = p_monthly_fee_record_id
      and organization_id = p_organization_id
      and resident_id = p_resident_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'monthly_fee_record_not_found' using errcode = 'P0002';
    end if;

    if p_amount > v_fee_record.balance_amount and not p_is_advance then
      raise exception 'payment_amount_exceeds_due_balance' using errcode = '23514';
    end if;
  end if;

  insert into public.payments (
    organization_id,
    hostel_id,
    resident_id,
    monthly_fee_record_id,
    amount,
    method,
    status,
    transaction_id,
    idempotency_key,
    provider,
    notes,
    is_advance,
    is_partial,
    metadata,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_resident_id,
    p_monthly_fee_record_id,
    p_amount,
    'upi'::public.payment_method_enum,
    'initiated'::public.payment_status_enum,
    v_transaction_id,
    trim(p_idempotency_key),
    'upi',
    p_notes,
    p_is_advance,
    p_is_partial,
    jsonb_build_object(
      'submission_state', 'proof_required',
      'idempotency_key', trim(p_idempotency_key),
      'draft_created_at', now(),
      'manual_upi_workflow', true
    ),
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke execute on function public.create_resident_upi_payment_draft(uuid, uuid, uuid, uuid, numeric, text, text, text, boolean, boolean, uuid)
  from public, anon;
grant execute on function public.create_resident_upi_payment_draft(uuid, uuid, uuid, uuid, numeric, text, text, text, boolean, boolean, uuid)
  to authenticated, service_role;

commit;
