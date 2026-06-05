-- P1 finance hardening: visible admission finance state, collection follow-ups,
-- and database-owned dashboard aggregate totals.

do $$
begin
  alter type public.resident_status_enum
    add value if not exists 'pending_finance' after 'draft';
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.collection_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  resident_id uuid not null references public.residents(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  next_followup_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references public.users(id) on delete set null
);

create index if not exists collection_followups_tenant_idx
  on public.collection_followups (organization_id, hostel_id, created_at desc)
  where deleted_at is null;

create index if not exists collection_followups_resident_idx
  on public.collection_followups (organization_id, resident_id, created_at desc)
  where deleted_at is null;

create index if not exists collection_followups_open_next_idx
  on public.collection_followups (organization_id, hostel_id, next_followup_at)
  where deleted_at is null and status = 'open';

drop trigger if exists set_collection_followups_updated_at on public.collection_followups;
create trigger set_collection_followups_updated_at
before update on public.collection_followups
for each row execute function public.set_updated_at();

alter table public.collection_followups enable row level security;
alter table public.collection_followups force row level security;

revoke all on table public.collection_followups from public, anon;
grant select, insert, update on table public.collection_followups to authenticated;
grant all on table public.collection_followups to service_role;

drop policy if exists collection_followups_finance_select on public.collection_followups;
create policy collection_followups_finance_select
  on public.collection_followups
  for select
  using (
    deleted_at is null
    and public.can_manage_finance(organization_id, hostel_id)
  );

drop policy if exists collection_followups_finance_insert on public.collection_followups;
create policy collection_followups_finance_insert
  on public.collection_followups
  for insert
  with check (
    deleted_at is null
    and public.can_manage_finance(organization_id, hostel_id)
  );

drop policy if exists collection_followups_finance_update on public.collection_followups;
create policy collection_followups_finance_update
  on public.collection_followups
  for update
  using (
    deleted_at is null
    and public.can_manage_finance(organization_id, hostel_id)
  )
  with check (
    deleted_at is null
    and public.can_manage_finance(organization_id, hostel_id)
  );

create or replace function public.finance_dashboard_aggregates(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_today date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', p_today)::date;
  v_next_month date := (date_trunc('month', p_today) + interval '1 month')::date;
  v_result jsonb;
begin
  if not public.can_manage_finance(p_organization_id, p_hostel_id) then
    raise exception 'finance_dashboard_forbidden' using errcode = '42501';
  end if;

  with resident_scope as (
    select r.id, r.status, r.is_active
    from public.residents r
    where r.organization_id = p_organization_id
      and (p_hostel_id is null or r.hostel_id = p_hostel_id)
      and r.deleted_at is null
  ),
  fee_scope as (
    select
      mfr.id,
      mfr.resident_id,
      mfr.period_month,
      mfr.due_date,
      mfr.total_amount,
      mfr.balance_amount,
      mfr.status
    from public.monthly_fee_records mfr
    where mfr.organization_id = p_organization_id
      and (p_hostel_id is null or mfr.hostel_id = p_hostel_id)
      and mfr.deleted_at is null
  ),
  payment_scope as (
    select p.id, p.amount, p.status, p.verified_at, p.is_advance
    from public.payments p
    where p.organization_id = p_organization_id
      and (p_hostel_id is null or p.hostel_id = p_hostel_id)
      and p.deleted_at is null
  ),
  invoice_scope as (
    select i.id
    from public.invoices i
    where i.organization_id = p_organization_id
      and (p_hostel_id is null or i.hostel_id = p_hostel_id)
      and i.deleted_at is null
  ),
  counts as (
    select
      (select count(*) from resident_scope) as resident_count,
      (select count(*) from fee_scope) as fee_count,
      (select count(*) from payment_scope) as payment_count,
      (select count(*) from invoice_scope) as invoice_count
  ),
  aging_source as (
    select
      case
        when fs.due_date >= p_today then 'current'
        when p_today - fs.due_date between 1 and 7 then '1-7'
        when p_today - fs.due_date between 8 and 15 then '8-15'
        when p_today - fs.due_date between 16 and 30 then '16-30'
        else '30+'
      end as bucket,
      count(*) as due_count,
      coalesce(sum(fs.balance_amount), 0) as due_amount
    from fee_scope fs
    where fs.balance_amount > 0
      and fs.status in (
        'pending'::public.fee_record_status_enum,
        'partial'::public.fee_record_status_enum,
        'overdue'::public.fee_record_status_enum
      )
    group by 1
  ),
  aging_buckets as (
    select *
    from (values
      ('current', 'Current', 1),
      ('1-7', '1-7 Days', 2),
      ('8-15', '8-15 Days', 3),
      ('16-30', '16-30 Days', 4),
      ('30+', '30+ Days', 5)
    ) as buckets(key, label, sort_order)
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'expectedCollection', coalesce((
        select sum(fs.total_amount)
        from fee_scope fs
        where fs.status <> 'cancelled'::public.fee_record_status_enum
          and fs.period_month >= v_month_start
          and fs.period_month < v_next_month
      ), 0),
      'collectedAmount', coalesce((
        select sum(ps.amount)
        from payment_scope ps
        where ps.status = 'verified'::public.payment_status_enum
          and ps.verified_at is not null
          and ps.verified_at >= v_month_start::timestamptz
          and ps.verified_at < v_next_month::timestamptz
      ), 0),
      'pendingAmount', coalesce((
        select sum(fs.balance_amount)
        from fee_scope fs
        where fs.balance_amount > 0
          and fs.status in (
            'pending'::public.fee_record_status_enum,
            'partial'::public.fee_record_status_enum,
            'overdue'::public.fee_record_status_enum
          )
      ), 0),
      'activeResidents', (
        select count(*)
        from resident_scope rs
        where rs.status = 'active'::public.resident_status_enum
          and rs.is_active is true
      ),
      'residentsWithPending', (
        select count(distinct fs.resident_id)
        from fee_scope fs
        where fs.balance_amount > 0
          and fs.status in (
            'pending'::public.fee_record_status_enum,
            'partial'::public.fee_record_status_enum,
            'overdue'::public.fee_record_status_enum
          )
      ),
      'overdueAmount', coalesce((
        select sum(fs.balance_amount)
        from fee_scope fs
        where fs.balance_amount > 0
          and fs.due_date < p_today
          and fs.status in (
            'pending'::public.fee_record_status_enum,
            'partial'::public.fee_record_status_enum,
            'overdue'::public.fee_record_status_enum
          )
      ), 0),
      'advanceBalance', coalesce((
        select sum(ps.amount)
        from payment_scope ps
        where ps.status = 'verified'::public.payment_status_enum
          and ps.is_advance is true
      ), 0)
    ),
    'agingBuckets', (
      select jsonb_agg(
        jsonb_build_object(
          'key', ab.key,
          'label', ab.label,
          'count', coalesce(src.due_count, 0),
          'amount', coalesce(src.due_amount, 0)
        )
        order by ab.sort_order
      )
      from aging_buckets ab
      left join aging_source src on src.bucket = ab.key
    ),
    'metadata', jsonb_build_object(
      'truncated', false,
      'totalRowsScanned', (
        select resident_count + fee_count + payment_count + invoice_count
        from counts
      )
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.finance_dashboard_aggregates(uuid, uuid, date) is
  'Finance dashboard aggregate KPI and aging buckets. Guarded by finance.manage and never truncates rows.';

revoke execute on function public.finance_dashboard_aggregates(uuid, uuid, date)
  from public, anon;
grant execute on function public.finance_dashboard_aggregates(uuid, uuid, date)
  to authenticated, service_role;
