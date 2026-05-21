-- Production stabilization hardening.
-- Adds secure payment proof submission RPCs, tighter financial guards,
-- admissions RLS force mode, and caller-safe view execution.

-- ---------------------------------------------------------------------------
-- Caller-safe views and admissions RLS hardening
-- ---------------------------------------------------------------------------

alter view if exists public.resident_balance_view set (security_invoker = true);
alter view if exists public.room_occupancy_view set (security_invoker = true);
alter view if exists public.hostel_vacancy_view set (security_invoker = true);
alter view if exists public.room_vacancy_view set (security_invoker = true);

alter table if exists public.hostel_capacity force row level security;
alter table if exists public.room_capacity force row level security;
alter table if exists public.leads force row level security;
alter table if exists public.lead_notes force row level security;
alter table if exists public.lead_activity_logs force row level security;
alter table if exists public.reservations force row level security;
alter table if exists public.reservation_payments force row level security;

create index if not exists payments_submission_state_idx
  on public.payments (organization_id, status, created_at desc)
  where status = 'initiated' and deleted_at is null;

create index if not exists leads_recent_phone_idx
  on public.leads (organization_id, hostel_id, phone, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Helper hardening
-- ---------------------------------------------------------------------------

create or replace function public.safe_uuid(input text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return input::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.storage_object_organization_id(object_name text)
returns uuid
language sql
stable
set search_path = public
as $$
  select public.safe_uuid(split_part(object_name, '/', 1));
$$;

create or replace function public.storage_object_resident_id(object_name text)
returns uuid
language sql
stable
set search_path = public
as $$
  select public.safe_uuid(split_part(object_name, '/', 2));
$$;

-- Keep financial rows protected, but allow the narrow resident-owned transition
-- from payment draft -> pending after a valid proof upload has been linked.
create or replace function public.protect_financial_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_context() then
    return new;
  end if;

  if tg_table_name = 'payments'
     and old.status = 'initiated'::public.payment_status_enum
     and new.status = 'pending'::public.payment_status_enum
     and old.organization_id = new.organization_id
     and old.hostel_id = new.hostel_id
     and old.resident_id = new.resident_id
     and old.amount = new.amount
     and old.method = new.method
     and old.transaction_id is not distinct from new.transaction_id
     and old.monthly_fee_record_id is not distinct from new.monthly_fee_record_id
     and old.invoice_id is not distinct from new.invoice_id
     and public.owns_resident(old.resident_id) then
    return new;
  end if;

  if not public.can_manage_finance(old.organization_id, old.hostel_id) then
    raise exception 'Only finance admins can update financial records';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic resident UPI submission flow
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
  v_resident public.residents;
  v_existing public.payments;
  v_payment public.payments;
begin
  if p_actor_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if p_amount <= 0 then
    raise exception 'payment_amount_must_be_positive' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_transaction_id, '')), '') is null then
    raise exception 'transaction_reference_required' using errcode = '23514';
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

  if p_monthly_fee_record_id is not null and not exists (
    select 1
    from public.monthly_fee_records
    where id = p_monthly_fee_record_id
      and organization_id = p_organization_id
      and resident_id = p_resident_id
      and deleted_at is null
  ) then
    raise exception 'monthly_fee_record_not_found' using errcode = 'P0002';
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
    trim(p_transaction_id),
    trim(p_idempotency_key),
    'upi',
    p_notes,
    p_is_advance,
    p_is_partial,
    jsonb_build_object(
      'submission_state', 'proof_required',
      'idempotency_key', trim(p_idempotency_key),
      'draft_created_at', now()
    ),
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

create or replace function public.finalize_payment_submission(
  p_payment_id uuid,
  p_organization_id uuid,
  p_proof_document_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns public.payments
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_payment public.payments;
  v_document public.documents;
begin
  if p_actor_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
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

  if v_payment.status = 'verified' then
    raise exception 'payment_already_verified' using errcode = '23505';
  end if;

  if not (
    public.can_manage_finance(v_payment.organization_id, v_payment.hostel_id)
    or public.owns_resident(v_payment.resident_id)
  ) then
    raise exception 'payment_submission_forbidden' using errcode = '42501';
  end if;

  select *
  into v_document
  from public.documents
  where id = p_proof_document_id
    and organization_id = p_organization_id
    and payment_id = p_payment_id
    and resident_id = v_payment.resident_id
    and document_type = 'payment_receipt'::public.document_type_enum
    and status <> 'rejected'::public.document_status_enum
    and deleted_at is null
  for update;

  if not found then
    raise exception 'valid_payment_proof_required' using errcode = '23514';
  end if;

  if v_payment.status = 'pending' then
    return v_payment;
  end if;

  if v_payment.status <> 'initiated' then
    raise exception 'payment_status_not_submittable' using errcode = '23514';
  end if;

  update public.payments
  set
    status = 'pending'::public.payment_status_enum,
    updated_by = p_actor_user_id,
    lock_version = lock_version + 1,
    metadata = metadata || jsonb_build_object(
      'submission_state', 'proof_uploaded',
      'proof_document_id', p_proof_document_id,
      'submitted_at', now()
    )
  where id = p_payment_id
    and organization_id = p_organization_id
  returning * into v_payment;

  return v_payment;
end;
$$;

-- Verification is finance-only via service authorization plus RLS, and now
-- rejects unfinished draft payments while linking invoices inside the locked DB flow.
create or replace function public.verify_payment_atomic(
  p_payment_id uuid,
  p_organization_id uuid,
  p_verifier_user_id uuid,
  p_idempotency_key text default null
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_invoice public.invoices;
begin
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

  if v_payment.status = 'verified' then
    if p_idempotency_key is not null
       and v_payment.metadata ->> 'verification_idempotency_key' = p_idempotency_key then
      return v_payment;
    end if;

    raise exception 'payment_already_verified' using errcode = '23505';
  end if;

  if v_payment.status = 'initiated' then
    raise exception 'payment_proof_submission_not_finalized' using errcode = '23514';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'payment_status_not_verifiable' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.documents d
    where d.organization_id = p_organization_id
      and d.payment_id = p_payment_id
      and d.resident_id = v_payment.resident_id
      and d.document_type = 'payment_receipt'::public.document_type_enum
      and d.status <> 'rejected'::public.document_status_enum
      and d.deleted_at is null
  ) then
    raise exception 'payment_proof_required' using errcode = '23514';
  end if;

  if v_payment.monthly_fee_record_id is not null and v_payment.invoice_id is null then
    v_invoice := public.create_monthly_fee_invoice_atomic(
      p_organization_id,
      v_payment.monthly_fee_record_id,
      p_verifier_user_id
    );
    v_payment.invoice_id := v_invoice.id;
  end if;

  update public.payments
  set
    invoice_id = coalesce(v_payment.invoice_id, invoice_id),
    status = 'verified',
    verified_at = now(),
    paid_at = coalesce(paid_at, now()),
    verified_by = p_verifier_user_id,
    updated_by = p_verifier_user_id,
    lock_version = lock_version + 1,
    metadata = metadata || jsonb_build_object(
      'verification_idempotency_key', p_idempotency_key,
      'verified_atomically_at', now()
    )
  where id = p_payment_id
    and organization_id = p_organization_id
  returning * into v_payment;

  if v_payment.monthly_fee_record_id is not null then
    update public.monthly_fee_records
    set
      paid_amount = least(total_amount, paid_amount + v_payment.amount),
      balance_amount = greatest(0, total_amount - (paid_amount + v_payment.amount)),
      status = case
        when greatest(0, total_amount - (paid_amount + v_payment.amount)) = 0 then 'paid'::public.fee_record_status_enum
        when paid_amount + v_payment.amount > 0 then 'partial'::public.fee_record_status_enum
        else status
      end,
      updated_by = p_verifier_user_id,
      updated_at = now()
    where id = v_payment.monthly_fee_record_id
      and organization_id = p_organization_id
      and deleted_at is null;
  end if;

  if v_payment.invoice_id is not null then
    update public.invoices
    set
      paid_amount = least(total_amount, paid_amount + v_payment.amount),
      balance_amount = greatest(0, total_amount - (paid_amount + v_payment.amount)),
      status = case
        when greatest(0, total_amount - (paid_amount + v_payment.amount)) = 0 then 'paid'::public.invoice_status_enum
        when paid_amount + v_payment.amount > 0 then 'partially_paid'::public.invoice_status_enum
        else status
      end,
      updated_by = p_verifier_user_id,
      updated_at = now()
    where id = v_payment.invoice_id
      and organization_id = p_organization_id
      and deleted_at is null;
  end if;

  return v_payment;
end;
$$;

revoke execute on function public.create_resident_upi_payment_draft(uuid, uuid, uuid, uuid, numeric, text, text, text, boolean, boolean, uuid)
  from public, anon;
grant execute on function public.create_resident_upi_payment_draft(uuid, uuid, uuid, uuid, numeric, text, text, text, boolean, boolean, uuid)
  to authenticated, service_role;

revoke execute on function public.finalize_payment_submission(uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.finalize_payment_submission(uuid, uuid, uuid, uuid)
  to authenticated, service_role;

revoke execute on function public.verify_payment_atomic(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.verify_payment_atomic(uuid, uuid, uuid, text)
  to authenticated, service_role;

-- High-risk onboarding helpers are service-role only. Auth trigger driven sync remains intact.
revoke execute on function public.assign_default_role(uuid, uuid, uuid, public.user_role_enum, jsonb)
  from public, anon, authenticated;
revoke execute on function public.onboard_admin(uuid, uuid, uuid, public.user_role_enum)
  from public, anon, authenticated;
revoke execute on function public.onboard_resident(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_default_role(uuid, uuid, uuid, public.user_role_enum, jsonb)
  to service_role;
grant execute on function public.onboard_admin(uuid, uuid, uuid, public.user_role_enum)
  to service_role;
grant execute on function public.onboard_resident(uuid, uuid)
  to service_role;
