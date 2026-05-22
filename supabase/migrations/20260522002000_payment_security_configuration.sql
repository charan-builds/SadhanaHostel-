-- Payment security configuration hardening.
-- Adds finance-admin controlled UPI/account rotation, verification policy fields,
-- audit persistence, and payment-setting snapshots for manual UPI drafts.

begin;

alter table public.payment_settings
  add column if not exists require_utr boolean not null default true,
  add column if not exists require_screenshot boolean not null default true,
  add column if not exists allow_partial_payment boolean not null default true,
  add column if not exists allow_advance_payment boolean not null default true,
  add column if not exists auto_expire_pending_payments boolean not null default true,
  add column if not exists min_payment_amount numeric(12,2) not null default 1,
  add column if not exists utr_regex text not null default '^[A-Z0-9][A-Z0-9._/-]{5,63}$',
  add column if not exists duplicate_detection_strictness text not null default 'strict',
  add column if not exists version integer not null default 1,
  add column if not exists rotated_from_setting_id uuid references public.payment_settings(id) on delete set null,
  add column if not exists activated_at timestamptz,
  add column if not exists deactivated_at timestamptz,
  add column if not exists qr_version integer not null default 1,
  add column if not exists qr_replaced_at timestamptz;

alter table public.payment_settings
  drop constraint if exists payment_settings_min_payment_amount_chk,
  add constraint payment_settings_min_payment_amount_chk check (min_payment_amount > 0);

alter table public.payment_settings
  drop constraint if exists payment_settings_duplicate_detection_chk,
  add constraint payment_settings_duplicate_detection_chk check (
    duplicate_detection_strictness in ('standard', 'strict')
  );

alter table public.payment_settings
  drop constraint if exists payment_settings_version_chk,
  add constraint payment_settings_version_chk check (version >= 1 and qr_version >= 1);

create index if not exists payment_settings_rotation_idx
  on public.payment_settings (organization_id, hostel_id, rotated_from_setting_id, created_at desc)
  where deleted_at is null;

create index if not exists payment_settings_updated_at_idx
  on public.payment_settings (organization_id, hostel_id, updated_at desc)
  where deleted_at is null;

create unique index if not exists payment_settings_active_upi_uidx
  on public.payment_settings (organization_id, hostel_id, lower(upi_id))
  where is_active = true
    and upi_id is not null
    and deleted_at is null;

update public.payment_settings
set activated_at = coalesce(activated_at, created_at)
where is_active = true
  and activated_at is null;

-- Replace the original upsert function with a wider, rotation-aware version.
drop function if exists public.upsert_payment_setting_atomic(
  uuid, uuid, uuid, public.payment_method_enum, text, text, text, text, text, text, boolean, boolean, text, uuid
);

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
  p_actor_user_id uuid default auth.uid(),
  p_require_utr boolean default true,
  p_require_screenshot boolean default true,
  p_allow_partial_payment boolean default true,
  p_allow_advance_payment boolean default true,
  p_auto_expire_pending_payments boolean default true,
  p_min_payment_amount numeric default 1,
  p_utr_regex text default '^[A-Z0-9][A-Z0-9._/-]{5,63}$',
  p_duplicate_detection_strictness text default 'strict',
  p_rotated_from_setting_id uuid default null,
  p_qr_replaced boolean default false
)
returns public.payment_settings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_setting public.payment_settings;
  v_previous public.payment_settings;
  v_next_version integer := 1;
  v_next_qr_version integer := 1;
  v_has_previous boolean := false;
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

  if p_min_payment_amount <= 0 then
    raise exception 'min_payment_amount_must_be_positive' using errcode = '23514';
  end if;

  if p_duplicate_detection_strictness not in ('standard', 'strict') then
    raise exception 'invalid_duplicate_detection_strictness' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':payment-settings:' || p_hostel_id::text, 0)
  );

  if p_id is not null then
    select *
    into v_previous
    from public.payment_settings
    where id = p_id
      and organization_id = p_organization_id
      and hostel_id = p_hostel_id
      and deleted_at is null
    for update;

    v_has_previous := found;
  elsif p_rotated_from_setting_id is not null then
    select *
    into v_previous
    from public.payment_settings
    where id = p_rotated_from_setting_id
      and organization_id = p_organization_id
      and hostel_id = p_hostel_id
      and deleted_at is null
    for update;

    v_has_previous := found;
  end if;

  if v_has_previous then
    v_next_version := coalesce(v_previous.version, 1) + case when p_id is null then 1 else 0 end;
    v_next_qr_version := coalesce(v_previous.qr_version, 1) + case when p_qr_replaced then 1 else 0 end;
  end if;

  if p_is_active then
    update public.payment_settings
    set
      is_active = false,
      deactivated_at = coalesce(deactivated_at, now()),
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
      require_utr = p_require_utr,
      require_screenshot = p_require_screenshot,
      allow_partial_payment = p_allow_partial_payment,
      allow_advance_payment = p_allow_advance_payment,
      auto_expire_pending_payments = p_auto_expire_pending_payments,
      min_payment_amount = p_min_payment_amount,
      utr_regex = nullif(trim(coalesce(p_utr_regex, '')), ''),
      duplicate_detection_strictness = p_duplicate_detection_strictness,
      version = coalesce(version, 1),
      qr_version = case when p_qr_replaced then coalesce(qr_version, 1) + 1 else coalesce(qr_version, 1) end,
      qr_replaced_at = case when p_qr_replaced then now() else qr_replaced_at end,
      activated_at = case when p_is_active then coalesce(activated_at, now()) else activated_at end,
      deactivated_at = case when p_is_active then null else coalesce(deactivated_at, now()) end,
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
    require_utr,
    require_screenshot,
    allow_partial_payment,
    allow_advance_payment,
    auto_expire_pending_payments,
    min_payment_amount,
    utr_regex,
    duplicate_detection_strictness,
    version,
    rotated_from_setting_id,
    activated_at,
    qr_version,
    qr_replaced_at,
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
    p_require_utr,
    p_require_screenshot,
    p_allow_partial_payment,
    p_allow_advance_payment,
    p_auto_expire_pending_payments,
    p_min_payment_amount,
    nullif(trim(coalesce(p_utr_regex, '')), ''),
    p_duplicate_detection_strictness,
    v_next_version,
    p_rotated_from_setting_id,
    case when p_is_active then now() else null end,
    v_next_qr_version,
    case when p_qr_replaced then now() else null end,
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_setting;

  return v_setting;
end;
$$;

grant execute on function public.upsert_payment_setting_atomic(
  uuid,
  uuid,
  uuid,
  public.payment_method_enum,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  numeric,
  text,
  text,
  uuid,
  boolean
) to authenticated, service_role;

-- Snapshot the active payment setting into resident-created UPI payment drafts so
-- account rotation does not change the operational context of pending payments.
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
  v_payment_setting public.payment_settings;
  v_transaction_id text := upper(trim(coalesce(p_transaction_id, '')));
begin
  if p_actor_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select *
  into v_payment_setting
  from public.payment_settings
  where organization_id = p_organization_id
    and hostel_id = p_hostel_id
    and is_active = true
    and deleted_at is null
  order by updated_at desc
  limit 1;

  if not found then
    raise exception 'active_payment_setting_required' using errcode = '23514';
  end if;

  if p_amount < v_payment_setting.min_payment_amount then
    raise exception 'payment_amount_below_minimum' using errcode = '23514';
  end if;

  if p_is_partial and not v_payment_setting.allow_partial_payment then
    raise exception 'partial_payments_disabled' using errcode = '23514';
  end if;

  if p_is_advance and not v_payment_setting.allow_advance_payment then
    raise exception 'advance_payments_disabled' using errcode = '23514';
  end if;

  if v_payment_setting.require_utr and (v_transaction_id is null or v_transaction_id = '') then
    raise exception 'transaction_reference_required' using errcode = '23514';
  end if;

  if v_transaction_id is not null
     and v_transaction_id <> ''
     and v_transaction_id !~ coalesce(v_payment_setting.utr_regex, '^[A-Z0-9][A-Z0-9._/-]{5,63}$') then
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

  if v_transaction_id is not null and v_transaction_id <> '' and exists (
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
    nullif(v_transaction_id, ''),
    trim(p_idempotency_key),
    'upi',
    p_notes,
    p_is_advance,
    p_is_partial,
    jsonb_build_object(
      'submission_state', case when v_payment_setting.require_screenshot then 'proof_required' else 'proof_optional' end,
      'idempotency_key', trim(p_idempotency_key),
      'draft_created_at', now(),
      'manual_upi_workflow', true,
      'payment_setting_id', v_payment_setting.id,
      'payment_setting_version', v_payment_setting.version,
      'payment_setting_qr_version', v_payment_setting.qr_version,
      'payment_setting_upi_id', v_payment_setting.upi_id,
      'payment_setting_qr_image_path', v_payment_setting.qr_image_path,
      'payment_setting_require_utr', v_payment_setting.require_utr,
      'payment_setting_require_screenshot', v_payment_setting.require_screenshot,
      'payment_setting_snapshot_at', now()
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
