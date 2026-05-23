-- Occupancy consistency hardening.
-- Active hostel vacancy is derived from active room allocations attached to active residents.
-- Snapshot tables are maintained for analytics, but views remain the source of truth.

-- ---------------------------------------------------------------------------
-- Source-of-truth vacancy views
-- ---------------------------------------------------------------------------

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
 and resident.status = 'active'
 and resident.is_active is true
 and resident.deleted_at is null
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
     and resident.status = 'active'
     and resident.is_active is true
     and resident.deleted_at is null
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
       and resident.status = 'active'
       and resident.is_active is true
       and resident.deleted_at is null
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

-- ---------------------------------------------------------------------------
-- Snapshot reconciliation
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_hostel_capacity(
  p_organization_id uuid,
  p_hostel_id uuid
)
returns public.hostel_capacity
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_capacity public.hostel_capacity;
  v_summary record;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':hostel:' || p_hostel_id::text || ':occupancy', 0)
  );

  insert into public.hostel_capacity (organization_id, hostel_id, total_beds)
  values (p_organization_id, p_hostel_id, 70)
  on conflict (organization_id, hostel_id) do nothing;

  insert into public.room_capacity (
    organization_id,
    hostel_id,
    room_id,
    total_beds,
    occupied_beds,
    reserved_beds,
    maintenance_blocked_beds,
    available_beds,
    last_calculated_at,
    updated_at
  )
  select
    rv.organization_id,
    rv.hostel_id,
    rv.room_id,
    rv.total_beds,
    rv.occupied_beds,
    rv.reserved_beds,
    rv.maintenance_blocked_beds,
    rv.available_beds,
    now(),
    now()
  from public.room_vacancy_view rv
  where rv.organization_id = p_organization_id
    and rv.hostel_id = p_hostel_id
  on conflict (organization_id, room_id) do update
  set
    hostel_id = excluded.hostel_id,
    total_beds = excluded.total_beds,
    occupied_beds = excluded.occupied_beds,
    reserved_beds = excluded.reserved_beds,
    maintenance_blocked_beds = excluded.maintenance_blocked_beds,
    available_beds = excluded.available_beds,
    last_calculated_at = now(),
    updated_at = now();

  select *
  into v_summary
  from public.hostel_vacancy_view
  where organization_id = p_organization_id
    and hostel_id = p_hostel_id;

  update public.hostel_capacity
  set
    occupied_beds = coalesce(v_summary.occupied_beds, 0),
    reserved_beds = coalesce(v_summary.reserved_beds, 0),
    available_beds = coalesce(
      v_summary.available_beds,
      greatest(total_beds - maintenance_blocked_beds, 0)
    ),
    last_calculated_at = now(),
    updated_at = now()
  where organization_id = p_organization_id
    and hostel_id = p_hostel_id
  returning * into v_capacity;

  return v_capacity;
end;
$$;

grant execute on function public.recalculate_hostel_capacity(uuid, uuid) to authenticated, service_role;

create or replace function public.refresh_capacity_after_occupancy_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_hostel_id uuid;
begin
  v_organization_id := coalesce(new.organization_id, old.organization_id);
  v_hostel_id := coalesce(new.hostel_id, old.hostel_id);

  if v_organization_id is not null and v_hostel_id is not null then
    perform public.recalculate_hostel_capacity(v_organization_id, v_hostel_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists room_allocations_refresh_capacity on public.room_allocations;
create trigger room_allocations_refresh_capacity
after insert or update or delete on public.room_allocations
for each row execute function public.refresh_capacity_after_occupancy_change();

drop trigger if exists rooms_refresh_capacity on public.rooms;
create trigger rooms_refresh_capacity
after insert or update of capacity, status, is_active, deleted_at on public.rooms
for each row execute function public.refresh_capacity_after_occupancy_change();

drop trigger if exists rooms_refresh_capacity_delete on public.rooms;
create trigger rooms_refresh_capacity_delete
after delete on public.rooms
for each row execute function public.refresh_capacity_after_occupancy_change();

drop trigger if exists reservations_refresh_capacity on public.reservations;
create trigger reservations_refresh_capacity
after insert or update of reserved_room_id, reserved_bed_count, reserved_until, status, deleted_at on public.reservations
for each row execute function public.refresh_capacity_after_occupancy_change();

drop trigger if exists reservations_refresh_capacity_delete on public.reservations;
create trigger reservations_refresh_capacity_delete
after delete on public.reservations
for each row execute function public.refresh_capacity_after_occupancy_change();

-- ---------------------------------------------------------------------------
-- Atomic allocation and checkout/deactivation
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
    and is_active is true
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
    status = 'active',
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

create or replace function public.deactivate_resident_atomic(
  p_organization_id uuid,
  p_resident_id uuid,
  p_actor_user_id uuid default null,
  p_reason text default null
)
returns public.residents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_resident public.residents;
  v_hostel_id uuid;
begin
  select *
  into v_resident
  from public.residents
  where id = p_resident_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'resident_not_found' using errcode = 'P0002';
  end if;

  v_hostel_id := v_resident.hostel_id;

  update public.room_allocations
  set
    status = 'completed',
    allocated_to = coalesce(allocated_to, current_date),
    reason = coalesce(reason, p_reason, 'Resident deactivated'),
    updated_by = p_actor_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and status = 'active'
    and deleted_at is null;

  update public.residents
  set
    status = 'archived',
    is_active = false,
    deleted_at = now(),
    deleted_by = p_actor_user_id,
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_resident_id
    and organization_id = p_organization_id
  returning * into v_resident;

  if v_hostel_id is not null then
    perform public.recalculate_hostel_capacity(p_organization_id, v_hostel_id);
  end if;

  return v_resident;
end;
$$;

grant execute on function public.deactivate_resident_atomic(uuid, uuid, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Operational anomaly view for repair dashboards and audits
-- ---------------------------------------------------------------------------

create or replace view public.occupancy_anomalies_view as
select
  r.organization_id,
  r.hostel_id,
  r.id as subject_id,
  'active_resident_without_allocation'::text as anomaly_type,
  r.full_name as subject_label,
  jsonb_build_object('resident_id', r.id, 'status', r.status) as details,
  now() as detected_at
from public.residents r
where r.status = 'active'
  and r.is_active is true
  and r.deleted_at is null
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
  'active_allocation_without_active_resident'::text as anomaly_type,
  coalesce(r.full_name, ra.resident_id::text) as subject_label,
  jsonb_build_object('allocation_id', ra.id, 'resident_id', ra.resident_id) as details,
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
    or r.status <> 'active'
    or r.is_active is not true
    or r.deleted_at is not null
  );

alter view if exists public.occupancy_anomalies_view set (security_invoker = true);
grant select on public.occupancy_anomalies_view to authenticated, service_role;
