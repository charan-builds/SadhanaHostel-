-- Reservation conversion must not bypass invite activation, onboarding, or
-- verified resident occupancy. Conversion creates an invited draft resident and
-- stores the reserved room as a preferred room. The room becomes operational
-- only when onboarding verification succeeds.

create or replace function public.convert_reservation_to_resident_atomic(
  p_organization_id uuid,
  p_reservation_id uuid,
  p_joined_on date default current_date,
  p_monthly_fee_amount numeric default null,
  p_security_deposit_amount numeric default 0,
  p_actor_user_id uuid default null
)
returns public.residents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reservation public.reservations;
  v_lead public.leads;
  v_room public.rooms;
  v_resident public.residents;
  v_admission_number text;
  v_requested_room jsonb := null;
begin
  if not public.can_manage_organization(p_organization_id) then
    raise exception 'reservation_conversion_forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':reservation:' || p_reservation_id::text, 0)
  );

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.status not in ('reserved', 'confirmed') or v_reservation.converted_resident_id is not null then
    raise exception 'reservation_not_convertible' using errcode = '23514';
  end if;

  select *
  into v_lead
  from public.leads
  where id = v_reservation.lead_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.reserved_room_id is not null then
    select *
    into v_room
    from public.rooms
    where id = v_reservation.reserved_room_id
      and organization_id = p_organization_id
      and hostel_id = v_reservation.hostel_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'room_not_found' using errcode = 'P0002';
    end if;

    v_requested_room := jsonb_build_object(
      'room_id', v_room.id,
      'room_number', v_room.room_number,
      'bed_label', null,
      'allocated_from', coalesce(p_joined_on, current_date),
      'source', 'reservation_conversion'
    );
  end if;

  v_admission_number :=
    'ADM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(v_reservation.id::text, 1, 8));

  insert into public.residents (
    organization_id,
    hostel_id,
    admission_number,
    full_name,
    preferred_name,
    phone,
    email,
    resident_type,
    parent_name,
    parent_phone,
    emergency_contact_name,
    emergency_contact_phone,
    status,
    onboarding_status,
    joined_on,
    monthly_fee_amount,
    security_deposit_amount,
    notes,
    created_by,
    updated_by,
    metadata
  )
  values (
    p_organization_id,
    v_reservation.hostel_id,
    v_admission_number,
    v_lead.full_name,
    split_part(v_lead.full_name, ' ', 1),
    v_lead.phone,
    v_lead.email::text,
    v_lead.resident_type,
    v_lead.parent_name,
    v_lead.parent_phone,
    v_lead.parent_name,
    v_lead.parent_phone,
    'draft',
    'invited',
    null,
    coalesce(p_monthly_fee_amount, v_room.base_monthly_fee, 0),
    coalesce(p_security_deposit_amount, 0),
    v_reservation.notes,
    p_actor_user_id,
    p_actor_user_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'lead_id', v_lead.id,
        'reservation_id', v_reservation.id,
        'converted_from_admissions', true,
        'requires_invite_activation', true,
        'operational_activation_pending', true,
        'requested_room_assignment', v_requested_room
      )
    )
  )
  returning * into v_resident;

  update public.reservations
  set
    status = 'converted_to_resident',
    converted_at = now(),
    converted_resident_id = v_resident.id,
    updated_by = p_actor_user_id,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'conversion_mode', 'invite_onboarding_required',
      'preferred_room_id', v_reservation.reserved_room_id,
      'operational_occupancy_created', false
    )
  where id = v_reservation.id;

  update public.leads
  set
    status = 'confirmed',
    joined_resident_id = v_resident.id,
    updated_by = p_actor_user_id
  where id = v_lead.id;

  insert into public.lead_activity_logs (
    organization_id,
    hostel_id,
    lead_id,
    reservation_id,
    activity_type,
    description,
    actor_user_id,
    created_by,
    updated_by,
    metadata
  )
  values (
    p_organization_id,
    v_reservation.hostel_id,
    v_lead.id,
    v_reservation.id,
    'converted_to_resident',
    'Reservation converted into invited draft resident. Occupancy waits for onboarding verification.',
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    jsonb_build_object(
      'resident_id', v_resident.id,
      'resident_status', v_resident.status,
      'onboarding_status', v_resident.onboarding_status,
      'operational_occupancy_created', false,
      'preferred_room_id', v_reservation.reserved_room_id
    )
  );

  perform public.recalculate_hostel_capacity(p_organization_id, v_reservation.hostel_id);

  return v_resident;
end;
$$;

grant execute on function public.convert_reservation_to_resident_atomic(
  uuid,
  uuid,
  date,
  numeric,
  numeric,
  uuid
) to authenticated, service_role;

create or replace function public.transition_resident_onboarding_atomic(
  p_resident_id uuid,
  p_organization_id uuid,
  p_next_status public.resident_onboarding_status_enum,
  p_rejection_reason text default null,
  p_actor_user_id uuid default auth.uid()
)
returns public.residents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_resident public.residents;
  v_previous_status public.resident_onboarding_status_enum;
  v_allowed boolean := false;
  v_requested_room_id uuid;
  v_requested_bed_label text;
  v_requested_allocated_from date;
  v_existing_allocation public.room_allocations;
begin
  if p_actor_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.can_manage_organization(p_organization_id) then
    raise exception 'resident_onboarding_forbidden' using errcode = '42501';
  end if;

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

  v_previous_status := v_resident.onboarding_status;

  v_allowed := case v_resident.onboarding_status
    when 'invited' then p_next_status in ('activated', 'profile_incomplete', 'suspended')
    when 'activated' then p_next_status in ('profile_incomplete', 'documents_pending', 'verification_pending', 'suspended')
    when 'profile_incomplete' then p_next_status in ('documents_pending', 'verification_pending', 'rejected', 'suspended')
    when 'documents_pending' then p_next_status in ('verification_pending', 'rejected', 'suspended')
    when 'verification_pending' then p_next_status in ('verified', 'rejected', 'suspended')
    when 'verified' then p_next_status in ('suspended')
    when 'rejected' then p_next_status in ('profile_incomplete', 'documents_pending', 'verification_pending', 'suspended')
    when 'suspended' then p_next_status in ('profile_incomplete', 'documents_pending', 'verification_pending', 'verified')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_onboarding_transition' using errcode = '23514';
  end if;

  update public.residents
  set
    onboarding_status = p_next_status,
    onboarding_rejection_reason = case
      when p_next_status = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '')
      else null
    end,
    onboarding_completed_at = case
      when p_next_status in ('verification_pending', 'verified') then coalesce(onboarding_completed_at, now())
      else onboarding_completed_at
    end,
    onboarding_verified_at = case
      when p_next_status = 'verified' then now()
      else null
    end,
    onboarding_verified_by = case
      when p_next_status = 'verified' then p_actor_user_id
      else null
    end,
    status = case
      when p_next_status = 'verified' then 'active'::public.resident_status_enum
      when p_next_status = 'suspended' then 'suspended'::public.resident_status_enum
      else status
    end,
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_resident_id
    and organization_id = p_organization_id
  returning * into v_resident;

  if p_next_status = 'verified' then
    v_requested_room_id := nullif(v_resident.metadata #>> '{requested_room_assignment,room_id}', '')::uuid;
    v_requested_bed_label := nullif(v_resident.metadata #>> '{requested_room_assignment,bed_label}', '');
    v_requested_allocated_from := coalesce(
      nullif(v_resident.metadata #>> '{requested_room_assignment,allocated_from}', '')::date,
      current_date
    );

    if v_requested_room_id is not null then
      select *
      into v_existing_allocation
      from public.room_allocations
      where organization_id = p_organization_id
        and resident_id = p_resident_id
        and status = 'active'
        and deleted_at is null
      for update;

      if not found then
        perform public.allocate_room_atomic(
          p_organization_id,
          v_resident.hostel_id,
          v_requested_room_id,
          v_resident.id,
          v_requested_bed_label,
          v_requested_allocated_from,
          null,
          nullif(v_resident.monthly_fee_amount, 0),
          'Onboarding verified; activating preferred room from admission reservation.',
          p_actor_user_id
        );

        select *
        into v_resident
        from public.residents
        where id = p_resident_id
          and organization_id = p_organization_id;
      end if;
    end if;
  end if;

  insert into public.audit_logs (
    organization_id,
    hostel_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    new_values,
    metadata,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    v_resident.hostel_id,
    p_actor_user_id,
    'residents',
    v_resident.id,
    'resident.onboarding_transition',
    to_jsonb(v_resident),
    jsonb_build_object(
      'next_status', p_next_status,
      'previous_status', v_previous_status,
      'preferred_room_activation_attempted', p_next_status = 'verified' and v_requested_room_id is not null
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return v_resident;
end;
$$;

revoke execute on function public.transition_resident_onboarding_atomic(
  uuid,
  uuid,
  public.resident_onboarding_status_enum,
  text,
  uuid
) from public, anon;
grant execute on function public.transition_resident_onboarding_atomic(
  uuid,
  uuid,
  public.resident_onboarding_status_enum,
  text,
  uuid
) to authenticated, service_role;
