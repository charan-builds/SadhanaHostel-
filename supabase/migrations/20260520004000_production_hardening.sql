-- Production hardening: protected allocation, invoice uniqueness, and proof lookup performance.
-- This migration is additive and safe to apply after the platform integration migration.

-- ---------------------------------------------------------------------------
-- Room allocation atomicity
-- ---------------------------------------------------------------------------

create or replace function public.allocate_room_atomic(
  p_organization_id uuid,
  p_hostel_id uuid,
  p_room_id uuid,
  p_resident_id uuid,
  p_bed_label text default null,
  p_allocated_from date default current_date,
  p_allocated_to date default null,
  p_monthly_fee_amount numeric default null,
  p_reason text default null,
  p_actor_user_id uuid default null
)
returns public.room_allocations
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_room public.rooms;
  v_resident public.residents;
  v_active_count integer;
  v_existing_allocation public.room_allocations;
  v_allocation public.room_allocations;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':room:' || p_room_id::text, 0)
  );

  select *
  into v_room
  from public.rooms
  where id = p_room_id
    and organization_id = p_organization_id
    and hostel_id = p_hostel_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  if v_room.status <> 'active' or v_room.is_active is not true then
    raise exception 'room_not_allocatable' using errcode = '23514';
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

  if v_resident.status in ('suspended', 'checked_out', 'archived') then
    raise exception 'resident_not_allocatable' using errcode = '23514';
  end if;

  select *
  into v_existing_allocation
  from public.room_allocations
  where resident_id = p_resident_id
    and organization_id = p_organization_id
    and status = 'active'
    and deleted_at is null
  for update;

  if found then
    raise exception 'resident_already_allocated' using errcode = '23505';
  end if;

  select count(*)::integer
  into v_active_count
  from public.room_allocations
  where room_id = p_room_id
    and organization_id = p_organization_id
    and status = 'active'
    and deleted_at is null;

  if v_active_count >= v_room.capacity then
    raise exception 'room_capacity_exceeded' using errcode = '23514';
  end if;

  insert into public.room_allocations (
    organization_id,
    hostel_id,
    room_id,
    resident_id,
    bed_label,
    allocated_from,
    allocated_to,
    monthly_fee_amount,
    reason,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_room_id,
    p_resident_id,
    p_bed_label,
    coalesce(p_allocated_from, current_date),
    p_allocated_to,
    coalesce(p_monthly_fee_amount, v_room.base_monthly_fee),
    p_reason,
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_allocation;

  return v_allocation;
end;
$$;

grant execute on function public.allocate_room_atomic(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  date,
  numeric,
  text,
  uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Invoice concurrency protection
-- ---------------------------------------------------------------------------

create unique index if not exists invoices_monthly_fee_record_uidx
  on public.invoices (organization_id, monthly_fee_record_id)
  where monthly_fee_record_id is not null and deleted_at is null;

create or replace function public.create_monthly_fee_invoice_atomic(
  p_organization_id uuid,
  p_monthly_fee_record_id uuid,
  p_actor_user_id uuid default null
)
returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_fee_record public.monthly_fee_records;
  v_organization public.organizations;
  v_existing_invoice public.invoices;
  v_invoice public.invoices;
  v_issue_date date := current_date;
  v_issue_month text := to_char(current_date, 'YYYYMM');
  v_sequence integer;
  v_prefix text;
  v_invoice_number text;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
begin
  select *
  into v_fee_record
  from public.monthly_fee_records
  where id = p_monthly_fee_record_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'monthly_fee_record_not_found' using errcode = 'P0002';
  end if;

  select *
  into v_existing_invoice
  from public.invoices
  where monthly_fee_record_id = p_monthly_fee_record_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if found then
    return v_existing_invoice;
  end if;

  select *
  into v_organization
  from public.organizations
  where id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':invoice:' || v_issue_month, 0)
  );

  select count(*)::integer + 1
  into v_sequence
  from public.invoices
  where organization_id = p_organization_id
    and issue_date >= date_trunc('month', v_issue_date)::date
    and issue_date < (date_trunc('month', v_issue_date)::date + interval '1 month')
    and deleted_at is null;

  v_prefix := left(
    regexp_replace(
      regexp_replace(
        upper(regexp_replace(trim(coalesce(v_organization.slug, 'SBH')), '[^A-Za-z0-9]+', '-', 'g')),
        '^-+',
        ''
      ),
      '-+$',
      ''
    ),
    12
  );
  v_prefix := coalesce(nullif(v_prefix, ''), 'SBH');
  v_invoice_number := format('%s-%s-%s', v_prefix, v_issue_month, lpad(v_sequence::text, 6, '0'));
  v_subtotal := v_fee_record.base_amount + v_fee_record.penalty_amount + v_fee_record.adjustment_amount;
  v_discount := v_fee_record.discount_amount + v_fee_record.advance_adjustment_amount;

  insert into public.invoices (
    organization_id,
    hostel_id,
    resident_id,
    monthly_fee_record_id,
    invoice_number,
    status,
    issue_date,
    due_date,
    subtotal_amount,
    discount_amount,
    tax_amount,
    total_amount,
    paid_amount,
    balance_amount,
    metadata,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    v_fee_record.hostel_id,
    v_fee_record.resident_id,
    v_fee_record.id,
    v_invoice_number,
    case
      when v_fee_record.balance_amount <= 0 then 'paid'::public.invoice_status_enum
      when v_fee_record.paid_amount > 0 then 'partially_paid'::public.invoice_status_enum
      else 'issued'::public.invoice_status_enum
    end,
    v_issue_date,
    v_fee_record.due_date,
    v_subtotal,
    v_discount,
    0,
    v_fee_record.total_amount,
    v_fee_record.paid_amount,
    v_fee_record.balance_amount,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'hostel_id', v_fee_record.hostel_id,
      'resident_id', v_fee_record.resident_id,
      'period_month', v_fee_record.period_month,
      'generated_by_user_id', p_actor_user_id,
      'source', 'monthly_fee',
      'generated_atomically_at', now()
    ),
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_invoice;

  return v_invoice;
exception
  when unique_violation then
    select *
    into v_existing_invoice
    from public.invoices
    where monthly_fee_record_id = p_monthly_fee_record_id
      and organization_id = p_organization_id
      and deleted_at is null;

    if found then
      return v_existing_invoice;
    end if;

    raise;
end;
$$;

grant execute on function public.create_monthly_fee_invoice_atomic(uuid, uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Payment proof lookup performance
-- ---------------------------------------------------------------------------

create index if not exists documents_payment_id_idx
  on public.documents (payment_id)
  where payment_id is not null and deleted_at is null;

create index if not exists documents_payment_proof_lookup_idx
  on public.documents (organization_id, payment_id, status, created_at desc)
  where document_type = 'payment_receipt'
    and payment_id is not null
    and deleted_at is null;
