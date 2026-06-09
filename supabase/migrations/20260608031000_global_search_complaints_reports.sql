-- Extend global search to support complaints and report shortcuts.
-- No table schema changes are introduced.

create or replace function public.search_tenant_records(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_query text default '',
  p_types text[] default array['residents', 'payments', 'rooms', 'notices', 'complaints', 'reports'],
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
  report_catalog as (
    select *
    from (
      values
        (
          '00000000-0000-4000-8000-000000000501'::uuid,
          'Finance reports'::text,
          'Export payment, invoice, receipt, collection, and monthly fee reports.'::text,
          'finance revenue payment payments invoice invoices receipt receipts collection collections monthly fee fees report reports export ledger reconciliation'::text
        ),
        (
          '00000000-0000-4000-8000-000000000502'::uuid,
          'Resident reports'::text,
          'Review resident occupancy, onboarding, complaints, support pressure, and operational reports.'::text,
          'resident residents occupancy onboarding complaints support operations report reports export hostel'::text
        )
    ) as reports(entity_id, title, subtitle, search_text)
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
      and (p_hostel_id is null or r.hostel_id = p_hostel_id)
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
      and (p_hostel_id is null or p.hostel_id = p_hostel_id)
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
      and (p_hostel_id is null or rm.hostel_id = p_hostel_id)
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
      and (p_hostel_id is null or n.hostel_id is null or n.hostel_id = p_hostel_id)
      and 'notices' = any(p_types)
      and n.deleted_at is null
      and n.status = 'published'
      and n.is_active = true
      and query.q @@ n.search_vector

    union all

    select
      'complaints'::text as entity_type,
      sr.id as entity_id,
      sr.subject as title,
      concat(sr.status::text, ' - ', sr.priority::text, ' - ', sr.category) as subtitle,
      ts_rank_cd(
        to_tsvector(
          'english',
          concat_ws(' ', sr.subject, sr.description, sr.category, sr.priority::text, sr.status::text)
        ),
        query.q
      ) as rank,
      sr.created_at
    from public.support_requests sr, query
    where sr.organization_id = p_organization_id
      and (p_hostel_id is null or sr.hostel_id = p_hostel_id)
      and 'complaints' = any(p_types)
      and sr.deleted_at is null
      and sr.is_active = true
      and query.q @@ to_tsvector(
        'english',
        concat_ws(' ', sr.subject, sr.description, sr.category, sr.priority::text, sr.status::text)
      )

    union all

    select
      'reports'::text as entity_type,
      rc.entity_id,
      rc.title,
      rc.subtitle,
      ts_rank_cd(to_tsvector('english', rc.search_text), query.q) as rank,
      now() as created_at
    from report_catalog rc, query
    where 'reports' = any(p_types)
      and query.q @@ to_tsvector('english', rc.search_text)
  )
  select *
  from results
  order by rank desc, created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_tenant_records(uuid, uuid, text, text[], integer, integer)
  to authenticated, service_role;
