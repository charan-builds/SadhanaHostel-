-- Lifecycle-aware operational state hardening.
-- Draft/invited/onboarding residents remain admission records only; beds and
-- billing become operational after verified onboarding and auth linkage.

create or replace function public.is_resident_operational_for_bed(
  p_status public.resident_status_enum,
  p_is_active boolean,
  p_user_id uuid,
  p_checkout_on date,
  p_onboarding_status public.resident_onboarding_status_enum,
  p_deleted_at timestamptz
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    p_status = 'active'::public.resident_status_enum
    and p_is_active is true
    and p_user_id is not null
    and p_checkout_on is null
    and p_onboarding_status = 'verified'::public.resident_onboarding_status_enum
    and p_deleted_at is null;
$$;

grant execute on function public.is_resident_operational_for_bed(
  public.resident_status_enum,
  boolean,
  uuid,
  date,
  public.resident_onboarding_status_enum,
  timestamptz
) to authenticated, service_role;

create or replace view public.room_occupancy_view as
select
  r.organization_id,
  r.hostel_id,
  r.id as room_id,
  r.room_number,
  r.capacity,
  count(ra.id) filter (
    where ra.status = 'active'
      and ra.deleted_at is null
      and resident.id is not null
  )::integer as occupied_count,
  greatest(
    r.capacity - count(ra.id) filter (
      where ra.status = 'active'
        and ra.deleted_at is null
        and resident.id is not null
    ),
    0
  )::integer as available_count
from public.rooms r
left join public.room_allocations ra
  on ra.room_id = r.id
 and ra.organization_id = r.organization_id
left join public.residents resident
  on resident.id = ra.resident_id
 and resident.organization_id = ra.organization_id
 and resident.hostel_id = ra.hostel_id
 and public.is_resident_operational_for_bed(
   resident.status,
   resident.is_active,
   resident.user_id,
   resident.checkout_on,
   resident.onboarding_status,
   resident.deleted_at
 )
where r.deleted_at is null
group by r.organization_id, r.hostel_id, r.id, r.room_number, r.capacity;

create or replace view public.room_vacancy_view as
select
  r.organization_id,
  r.hostel_id,
  r.id as room_id,
  r.room_number,
  r.room_name,
  r.room_type,
  r.status as room_status,
  coalesce(rc.total_beds, r.capacity) as total_beds,
  (
    select count(*)::integer
    from public.room_allocations ra
    join public.residents resident
      on resident.id = ra.resident_id
     and resident.organization_id = ra.organization_id
     and resident.hostel_id = ra.hostel_id
     and public.is_resident_operational_for_bed(
       resident.status,
       resident.is_active,
       resident.user_id,
       resident.checkout_on,
       resident.onboarding_status,
       resident.deleted_at
     )
    where ra.room_id = r.id
      and ra.organization_id = r.organization_id
      and ra.status = 'active'
      and ra.deleted_at is null
  ) as occupied_beds,
  (
    select coalesce(sum(rv.reserved_bed_count), 0)::integer
    from public.reservations rv
    where rv.reserved_room_id = r.id
      and rv.organization_id = r.organization_id
      and rv.status in ('reserved', 'confirmed')
      and rv.reserved_until > now()
      and rv.deleted_at is null
  ) as reserved_beds,
  case
    when r.status = 'maintenance' then coalesce(rc.total_beds, r.capacity)
    else coalesce(rc.maintenance_blocked_beds, 0)
  end as maintenance_blocked_beds,
  greatest(
    coalesce(rc.total_beds, r.capacity)
    - (
      select count(*)::integer
      from public.room_allocations ra
      join public.residents resident
        on resident.id = ra.resident_id
       and resident.organization_id = ra.organization_id
       and resident.hostel_id = ra.hostel_id
       and public.is_resident_operational_for_bed(
         resident.status,
         resident.is_active,
         resident.user_id,
         resident.checkout_on,
         resident.onboarding_status,
         resident.deleted_at
       )
      where ra.room_id = r.id
        and ra.organization_id = r.organization_id
        and ra.status = 'active'
        and ra.deleted_at is null
    )
    - (
      select coalesce(sum(rv.reserved_bed_count), 0)::integer
      from public.reservations rv
      where rv.reserved_room_id = r.id
        and rv.organization_id = r.organization_id
        and rv.status in ('reserved', 'confirmed')
        and rv.reserved_until > now()
        and rv.deleted_at is null
    )
    - case
        when r.status = 'maintenance' then coalesce(rc.total_beds, r.capacity)
        else coalesce(rc.maintenance_blocked_beds, 0)
      end,
    0
  ) as available_beds,
  now() as calculated_at
from public.rooms r
left join public.room_capacity rc
  on rc.room_id = r.id
 and rc.organization_id = r.organization_id
where r.deleted_at is null
  and r.is_active is true;

alter view if exists public.room_occupancy_view set (security_invoker = true);
alter view if exists public.room_vacancy_view set (security_invoker = true);
grant select on public.room_occupancy_view to authenticated, service_role;
grant select on public.room_vacancy_view to authenticated, service_role;

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
  v_existing_allocation public.room_allocations;
  v_allocation public.room_allocations;
  v_available_beds integer;
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

  if not public.is_resident_operational_for_bed(
    v_resident.status,
    v_resident.is_active,
    v_resident.user_id,
    v_resident.checkout_on,
    v_resident.onboarding_status,
    v_resident.deleted_at
  ) then
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

  select available_beds
  into v_available_beds
  from public.room_vacancy_view
  where organization_id = p_organization_id
    and hostel_id = p_hostel_id
    and room_id = p_room_id;

  if coalesce(v_available_beds, 0) <= 0 then
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

  update public.residents
  set
    joined_on = coalesce(joined_on, coalesce(p_allocated_from, current_date)),
    monthly_fee_amount = coalesce(
      nullif(p_monthly_fee_amount, 0),
      nullif(monthly_fee_amount, 0),
      v_room.base_monthly_fee,
      0
    ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_resident_id
    and organization_id = p_organization_id;

  perform public.recalculate_hostel_capacity(p_organization_id, p_hostel_id);

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

create or replace view public.occupancy_anomalies_view as
select
  r.organization_id,
  r.hostel_id,
  r.id as subject_id,
  'operational_resident_without_allocation'::text as anomaly_type,
  r.full_name as subject_label,
  jsonb_build_object(
    'resident_id', r.id,
    'status', r.status,
    'onboarding_status', r.onboarding_status,
    'user_id', r.user_id
  ) as details,
  now() as detected_at
from public.residents r
where public.is_resident_operational_for_bed(
    r.status,
    r.is_active,
    r.user_id,
    r.checkout_on,
    r.onboarding_status,
    r.deleted_at
  )
  and not exists (
    select 1
    from public.room_allocations ra
    where ra.resident_id = r.id
      and ra.organization_id = r.organization_id
      and ra.hostel_id = r.hostel_id
      and ra.status = 'active'
      and ra.deleted_at is null
  )
union all
select
  ra.organization_id,
  ra.hostel_id,
  ra.id as subject_id,
  'active_allocation_without_operational_resident'::text as anomaly_type,
  coalesce(r.full_name, ra.resident_id::text) as subject_label,
  jsonb_build_object(
    'allocation_id', ra.id,
    'resident_id', ra.resident_id,
    'resident_status', r.status,
    'resident_onboarding_status', r.onboarding_status,
    'resident_user_id', r.user_id,
    'resident_is_active', r.is_active
  ) as details,
  now() as detected_at
from public.room_allocations ra
left join public.residents r
  on r.id = ra.resident_id
 and r.organization_id = ra.organization_id
 and r.hostel_id = ra.hostel_id
where ra.status = 'active'
  and ra.deleted_at is null
  and (
    r.id is null
    or not public.is_resident_operational_for_bed(
      r.status,
      r.is_active,
      r.user_id,
      r.checkout_on,
      r.onboarding_status,
      r.deleted_at
    )
  )
union all
select
  ra.organization_id,
  ra.hostel_id,
  ra.resident_id as subject_id,
  'resident_multiple_active_allocations'::text as anomaly_type,
  coalesce(r.full_name, ra.resident_id::text) as subject_label,
  jsonb_build_object(
    'resident_id', ra.resident_id,
    'active_allocation_count', count(*),
    'allocation_ids', jsonb_agg(ra.id order by ra.created_at)
  ) as details,
  now() as detected_at
from public.room_allocations ra
left join public.residents r
  on r.id = ra.resident_id
 and r.organization_id = ra.organization_id
where ra.status = 'active'
  and ra.deleted_at is null
group by ra.organization_id, ra.hostel_id, ra.resident_id, r.full_name
having count(*) > 1;

alter view if exists public.occupancy_anomalies_view set (security_invoker = true);
grant select on public.occupancy_anomalies_view to authenticated, service_role;

create or replace function public.repair_occupancy_consistency_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invalid_allocations integer := 0;
  v_duplicate_allocations integer := 0;
  v_recalculated_hostels integer := 0;
  v_hostel record;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':hostel:' || coalesce(p_hostel_id::text, 'all') || ':occupancy_repair',
      0
    )
  );

  update public.room_allocations ra
  set
    status = 'completed',
    allocated_to = coalesce(ra.allocated_to, current_date),
    reason = coalesce(ra.reason, 'Consistency repair: allocation no longer has a verified operational resident'),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.residents r
  where ra.resident_id = r.id
    and ra.organization_id = r.organization_id
    and ra.hostel_id = r.hostel_id
    and ra.organization_id = p_organization_id
    and (p_hostel_id is null or ra.hostel_id = p_hostel_id)
    and ra.status = 'active'
    and ra.deleted_at is null
    and not public.is_resident_operational_for_bed(
      r.status,
      r.is_active,
      r.user_id,
      r.checkout_on,
      r.onboarding_status,
      r.deleted_at
    );

  get diagnostics v_invalid_allocations = row_count;

  update public.room_allocations ra
  set
    status = 'completed',
    allocated_to = coalesce(ra.allocated_to, current_date),
    reason = coalesce(ra.reason, 'Consistency repair: duplicate active allocation closed'),
    updated_by = p_actor_user_id,
    updated_at = now()
  where ra.id in (
    select id
    from (
      select
        id,
        row_number() over (
          partition by organization_id, resident_id
          order by allocated_from desc, created_at desc, id desc
        ) as allocation_rank
      from public.room_allocations
      where organization_id = p_organization_id
        and (p_hostel_id is null or hostel_id = p_hostel_id)
        and status = 'active'
        and deleted_at is null
    ) ranked
    where allocation_rank > 1
  );

  get diagnostics v_duplicate_allocations = row_count;

  for v_hostel in
    select id
    from public.hostels
    where organization_id = p_organization_id
      and (p_hostel_id is null or id = p_hostel_id)
      and deleted_at is null
  loop
    perform public.recalculate_hostel_capacity(p_organization_id, v_hostel.id);
    v_recalculated_hostels := v_recalculated_hostels + 1;
  end loop;

  insert into public.audit_logs (
    organization_id,
    hostel_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    metadata,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_actor_user_id,
    'room_allocations',
    null,
    'occupancy.consistency_repair',
    jsonb_build_object(
      'invalid_allocations_repaired', v_invalid_allocations,
      'duplicate_allocations_repaired', v_duplicate_allocations,
      'hostels_recalculated', v_recalculated_hostels,
      'eligibility_rule', 'status active + onboarding verified + linked auth user + no checkout'
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'invalidAllocationsRepaired', v_invalid_allocations,
    'duplicateAllocationsRepaired', v_duplicate_allocations,
    'hostelsRecalculated', v_recalculated_hostels
  );
end;
$$;

grant execute on function public.repair_occupancy_consistency_atomic(uuid, uuid, uuid)
  to authenticated, service_role;

do $$
declare
  v_hostel record;
begin
  for v_hostel in
    select organization_id, id
    from public.hostels
    where deleted_at is null
  loop
    perform public.recalculate_hostel_capacity(v_hostel.organization_id, v_hostel.id);
  end loop;
end;
$$;
