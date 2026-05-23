-- Resident lifecycle occupancy hardening
-- Room occupancy is always derived from active room_allocations attached to active residents.
-- Temporary leave does not release a bed; checkout, suspension, archival, and transfer do.

create unique index if not exists room_allocations_active_bed_label_uidx
  on public.room_allocations (organization_id, room_id, lower(nullif(btrim(bed_label), '')))
  where status = 'active'
    and nullif(btrim(bed_label), '') is not null
    and deleted_at is null;

create or replace function public.transfer_room_atomic(
  p_organization_id uuid,
  p_hostel_id uuid,
  p_resident_id uuid,
  p_from_room_id uuid default null,
  p_to_room_id uuid default null,
  p_bed_label text default null,
  p_transfer_date date default current_date,
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
  v_resident public.residents;
  v_current_allocation public.room_allocations;
  v_new_allocation public.room_allocations;
  v_to_room public.rooms;
  v_available_beds integer;
  v_transfer_date date := coalesce(p_transfer_date, current_date);
begin
  if p_to_room_id is null then
    raise exception 'target_room_required' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':resident:' || p_resident_id::text, 0)
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':room:' || p_to_room_id::text, 0)
  );

  if p_from_room_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_organization_id::text || ':room:' || p_from_room_id::text, 0)
    );
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
  into v_current_allocation
  from public.room_allocations
  where resident_id = p_resident_id
    and organization_id = p_organization_id
    and hostel_id = p_hostel_id
    and status = 'active'
    and deleted_at is null
    and (p_from_room_id is null or room_id = p_from_room_id)
  for update;

  if not found then
    raise exception 'resident_not_allocated' using errcode = 'P0002';
  end if;

  if v_current_allocation.room_id = p_to_room_id then
    raise exception 'same_room_transfer' using errcode = '23514';
  end if;

  select *
  into v_to_room
  from public.rooms
  where id = p_to_room_id
    and organization_id = p_organization_id
    and hostel_id = p_hostel_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  if v_to_room.status <> 'active' or v_to_room.is_active is not true then
    raise exception 'room_not_allocatable' using errcode = '23514';
  end if;

  select available_beds
  into v_available_beds
  from public.room_vacancy_view
  where organization_id = p_organization_id
    and hostel_id = p_hostel_id
    and room_id = p_to_room_id;

  if coalesce(v_available_beds, 0) <= 0 then
    raise exception 'target_room_capacity_exceeded' using errcode = '23514';
  end if;

  update public.room_allocations
  set
    status = 'transferred',
    allocated_to = v_transfer_date,
    reason = coalesce(p_reason, reason, 'Resident transferred to another room'),
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = v_current_allocation.id
    and organization_id = p_organization_id;

  insert into public.room_allocations (
    organization_id,
    hostel_id,
    room_id,
    resident_id,
    bed_label,
    allocated_from,
    monthly_fee_amount,
    reason,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_to_room_id,
    p_resident_id,
    nullif(btrim(p_bed_label), ''),
    v_transfer_date,
    coalesce(
      nullif(p_monthly_fee_amount, 0),
      nullif(v_current_allocation.monthly_fee_amount, 0),
      v_to_room.base_monthly_fee,
      0
    ),
    coalesce(p_reason, 'Resident transferred from room ' || v_current_allocation.room_id::text),
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_new_allocation;

  update public.residents
  set
    status = 'active',
    monthly_fee_amount = coalesce(
      nullif(p_monthly_fee_amount, 0),
      nullif(monthly_fee_amount, 0),
      v_to_room.base_monthly_fee,
      0
    ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_resident_id
    and organization_id = p_organization_id;

  perform public.recalculate_hostel_capacity(p_organization_id, p_hostel_id);

  return v_new_allocation;
end;
$$;

grant execute on function public.transfer_room_atomic(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  numeric,
  text,
  uuid
) to authenticated, service_role;

create or replace function public.checkout_resident_atomic(
  p_organization_id uuid,
  p_resident_id uuid,
  p_checkout_date date default current_date,
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
  v_checkout_date date := coalesce(p_checkout_date, current_date);
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':resident:' || p_resident_id::text, 0)
  );

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
    allocated_to = coalesce(allocated_to, v_checkout_date),
    reason = coalesce(p_reason, reason, 'Resident checked out'),
    updated_by = p_actor_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and status = 'active'
    and deleted_at is null;

  update public.residents
  set
    status = 'checked_out',
    is_active = false,
    checkout_on = v_checkout_date,
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

grant execute on function public.checkout_resident_atomic(uuid, uuid, date, uuid, text)
  to authenticated, service_role;

create or replace function public.release_resident_occupancy_on_status_exit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (
    new.status in ('suspended', 'checked_out', 'archived')
    or new.is_active is not true
    or new.deleted_at is not null
  )
  and (
    old.status is distinct from new.status
    or old.is_active is distinct from new.is_active
    or old.deleted_at is distinct from new.deleted_at
  ) then
    update public.room_allocations
    set
      status = 'completed',
      allocated_to = coalesce(allocated_to, current_date),
      reason = coalesce(reason, 'Occupancy released after resident status changed to ' || new.status::text),
      updated_by = new.updated_by,
      updated_at = now()
    where organization_id = new.organization_id
      and resident_id = new.id
      and status = 'active'
      and deleted_at is null;

    if new.hostel_id is not null then
      perform public.recalculate_hostel_capacity(new.organization_id, new.hostel_id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists residents_release_occupancy_on_status_exit on public.residents;
create trigger residents_release_occupancy_on_status_exit
after update of status, is_active, deleted_at on public.residents
for each row execute function public.release_resident_occupancy_on_status_exit();

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
  jsonb_build_object(
    'allocation_id', ra.id,
    'resident_id', ra.resident_id,
    'resident_status', r.status,
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
    or r.status <> 'active'
    or r.is_active is not true
    or r.deleted_at is not null
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
having count(*) > 1
union all
select
  rooms.organization_id,
  rooms.hostel_id,
  rooms.id as subject_id,
  'room_over_capacity'::text as anomaly_type,
  rooms.room_number as subject_label,
  jsonb_build_object(
    'room_id', rooms.id,
    'capacity', rooms.capacity,
    'active_allocation_count', count(ra.id)
  ) as details,
  now() as detected_at
from public.rooms rooms
join public.room_allocations ra
  on ra.room_id = rooms.id
 and ra.organization_id = rooms.organization_id
 and ra.hostel_id = rooms.hostel_id
 and ra.status = 'active'
 and ra.deleted_at is null
where rooms.deleted_at is null
group by rooms.organization_id, rooms.hostel_id, rooms.id, rooms.room_number, rooms.capacity
having count(ra.id) > rooms.capacity;

alter view if exists public.occupancy_anomalies_view set (security_invoker = true);
grant select on public.occupancy_anomalies_view to authenticated, service_role;
