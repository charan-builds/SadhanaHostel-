-- Platform integration: full-text search and financial concurrency hardening.
-- This migration is additive and safe to apply after the foundation/RLS migrations.

-- ---------------------------------------------------------------------------
-- Payment idempotency and optimistic financial mutation support
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists idempotency_key text,
  add column if not exists lock_version integer not null default 0;

create unique index if not exists payments_org_idempotency_uidx
  on public.payments (organization_id, idempotency_key)
  where idempotency_key is not null and deleted_at is null;

create unique index if not exists payments_org_transaction_uidx
  on public.payments (organization_id, transaction_id)
  where transaction_id is not null and deleted_at is null;

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

  if v_payment.status not in ('initiated', 'pending') then
    raise exception 'payment_status_not_verifiable' using errcode = '23514';
  end if;

  update public.payments
  set
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

grant execute on function public.verify_payment_atomic(uuid, uuid, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- PostgreSQL full-text search vectors
-- ---------------------------------------------------------------------------

alter table public.residents
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(full_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(admission_number, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(phone, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(parent_name, '')), 'C')
  ) stored;

alter table public.rooms
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(room_number, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(room_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(room_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(block_name, '')), 'C')
  ) stored;

alter table public.notices
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(audience_type, '')), 'C')
  ) stored;

alter table public.payments
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(transaction_id, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(manual_reference, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(provider_reference, '')), 'B')
  ) stored;

create index if not exists residents_search_vector_gin_idx
  on public.residents using gin (search_vector);

create index if not exists rooms_search_vector_gin_idx
  on public.rooms using gin (search_vector);

create index if not exists notices_search_vector_gin_idx
  on public.notices using gin (search_vector);

create index if not exists payments_search_vector_gin_idx
  on public.payments using gin (search_vector);

create or replace function public.search_tenant_records(
  p_organization_id uuid,
  p_query text,
  p_types text[] default array['residents', 'payments', 'rooms', 'notices'],
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  rank real,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(nullif(trim(p_query), ''), '')) as q
  ),
  results as (
    select
      'residents'::text as entity_type,
      r.id as entity_id,
      r.full_name as title,
      r.admission_number as subtitle,
      ts_rank_cd(r.search_vector, query.q) as rank,
      r.created_at
    from public.residents r, query
    where r.organization_id = p_organization_id
      and 'residents' = any(p_types)
      and r.deleted_at is null
      and query.q @@ r.search_vector

    union all

    select
      'payments'::text as entity_type,
      p.id as entity_id,
      coalesce(p.transaction_id, p.manual_reference, p.id::text) as title,
      concat(p.status::text, ' - INR ', p.amount::text) as subtitle,
      ts_rank_cd(p.search_vector, query.q) as rank,
      p.created_at
    from public.payments p, query
    where p.organization_id = p_organization_id
      and 'payments' = any(p_types)
      and p.deleted_at is null
      and query.q @@ p.search_vector

    union all

    select
      'rooms'::text as entity_type,
      rm.id as entity_id,
      rm.room_number as title,
      rm.room_type as subtitle,
      ts_rank_cd(rm.search_vector, query.q) as rank,
      rm.created_at
    from public.rooms rm, query
    where rm.organization_id = p_organization_id
      and 'rooms' = any(p_types)
      and rm.deleted_at is null
      and query.q @@ rm.search_vector

    union all

    select
      'notices'::text as entity_type,
      n.id as entity_id,
      n.title as title,
      n.audience_type as subtitle,
      ts_rank_cd(n.search_vector, query.q) as rank,
      n.created_at
    from public.notices n, query
    where n.organization_id = p_organization_id
      and 'notices' = any(p_types)
      and n.deleted_at is null
      and n.status = 'published'
      and n.is_active = true
      and query.q @@ n.search_vector
  )
  select *
  from results
  order by rank desc, created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_tenant_records(uuid, text, text[], integer, integer)
  to authenticated, service_role;
