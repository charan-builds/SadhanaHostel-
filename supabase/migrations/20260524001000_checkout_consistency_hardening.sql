-- Checkout/deactivation consistency hardening.
-- Resident exit operations must atomically release occupancy, reconcile future
-- unpaid finance records, refresh vacancy snapshots, and leave actionable audit
-- context for operators.

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
  v_released_allocations integer := 0;
  v_cancelled_fee_records integer := 0;
  v_cancelled_invoices integer := 0;
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

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':hostel:' || v_hostel_id::text || ':occupancy', 0)
  );

  perform 1
  from public.room_allocations
  where organization_id = p_organization_id
    and hostel_id = v_hostel_id
    and resident_id = p_resident_id
    and status = 'active'
    and deleted_at is null
  for update;

  update public.room_allocations
  set
    status = 'completed',
    allocated_to = coalesce(allocated_to, v_checkout_date),
    reason = coalesce(p_reason, reason, 'Resident checked out; occupancy released atomically'),
    updated_by = p_actor_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and hostel_id = v_hostel_id
    and resident_id = p_resident_id
    and status = 'active'
    and deleted_at is null;

  get diagnostics v_released_allocations = row_count;

  update public.monthly_fee_records
  set
    status = 'cancelled',
    balance_amount = 0,
    notes = concat_ws(E'\n', notes, 'Cancelled during resident checkout on ' || v_checkout_date::text),
    metadata = metadata || jsonb_build_object(
      'checkout_reconciled_at', now(),
      'checkout_date', v_checkout_date,
      'previous_balance_amount', balance_amount
    ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and hostel_id = v_hostel_id
    and resident_id = p_resident_id
    and status in ('pending', 'overdue')
    and paid_amount = 0
    and period_month > date_trunc('month', v_checkout_date)::date
    and deleted_at is null;

  get diagnostics v_cancelled_fee_records = row_count;

  update public.invoices
  set
    status = 'cancelled',
    balance_amount = 0,
    cancelled_at = now(),
    cancelled_by = p_actor_user_id,
    cancellation_reason = coalesce(
      cancellation_reason,
      'Cancelled during resident checkout; no payment collected for a future period.'
    ),
    metadata = metadata || jsonb_build_object(
      'checkout_reconciled_at', now(),
      'checkout_date', v_checkout_date,
      'previous_balance_amount', balance_amount
    ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and hostel_id = v_hostel_id
    and resident_id = p_resident_id
    and status in ('draft', 'issued', 'overdue')
    and paid_amount = 0
    and deleted_at is null
    and (
      due_date is null
      or due_date > v_checkout_date
      or monthly_fee_record_id in (
        select id
        from public.monthly_fee_records
        where organization_id = p_organization_id
          and hostel_id = v_hostel_id
          and resident_id = p_resident_id
          and status = 'cancelled'
          and metadata ? 'checkout_reconciled_at'
      )
    );

  get diagnostics v_cancelled_invoices = row_count;

  update public.residents
  set
    status = 'checked_out',
    is_active = false,
    checkout_on = v_checkout_date,
    metadata = metadata || jsonb_build_object(
      'checkout_reconciled_at', now(),
      'released_allocations', v_released_allocations,
      'cancelled_future_fee_records', v_cancelled_fee_records,
      'cancelled_future_invoices', v_cancelled_invoices
    ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_resident_id
    and organization_id = p_organization_id
  returning * into v_resident;

  perform public.recalculate_hostel_capacity(p_organization_id, v_hostel_id);

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
    v_hostel_id,
    p_actor_user_id,
    'residents',
    p_resident_id,
    'resident.checkout_atomic',
    jsonb_build_object(
      'checkout_date', v_checkout_date,
      'released_allocations', v_released_allocations,
      'cancelled_future_fee_records', v_cancelled_fee_records,
      'cancelled_future_invoices', v_cancelled_invoices,
      'reason', p_reason
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return v_resident;
end;
$$;

grant execute on function public.checkout_resident_atomic(uuid, uuid, date, uuid, text)
  to authenticated, service_role;

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
  v_released_allocations integer := 0;
  v_cancelled_fee_records integer := 0;
  v_cancelled_invoices integer := 0;
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

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':hostel:' || v_hostel_id::text || ':occupancy', 0)
  );

  perform 1
  from public.room_allocations
  where organization_id = p_organization_id
    and hostel_id = v_hostel_id
    and resident_id = p_resident_id
    and status = 'active'
    and deleted_at is null
  for update;

  update public.room_allocations
  set
    status = 'completed',
    allocated_to = coalesce(allocated_to, current_date),
    reason = coalesce(p_reason, reason, 'Resident deactivated; occupancy released atomically'),
    updated_by = p_actor_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and hostel_id = v_hostel_id
    and resident_id = p_resident_id
    and status = 'active'
    and deleted_at is null;

  get diagnostics v_released_allocations = row_count;

  update public.monthly_fee_records
  set
    status = 'cancelled',
    balance_amount = 0,
    notes = concat_ws(E'\n', notes, 'Cancelled during resident deactivation on ' || current_date::text),
    metadata = metadata || jsonb_build_object(
      'deactivation_reconciled_at', now(),
      'previous_balance_amount', balance_amount
    ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and hostel_id = v_hostel_id
    and resident_id = p_resident_id
    and status in ('pending', 'overdue')
    and paid_amount = 0
    and period_month > date_trunc('month', current_date)::date
    and deleted_at is null;

  get diagnostics v_cancelled_fee_records = row_count;

  update public.invoices
  set
    status = 'cancelled',
    balance_amount = 0,
    cancelled_at = now(),
    cancelled_by = p_actor_user_id,
    cancellation_reason = coalesce(
      cancellation_reason,
      'Cancelled during resident deactivation; no payment collected for a future period.'
    ),
    metadata = metadata || jsonb_build_object(
      'deactivation_reconciled_at', now(),
      'previous_balance_amount', balance_amount
    ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where organization_id = p_organization_id
    and hostel_id = v_hostel_id
    and resident_id = p_resident_id
    and status in ('draft', 'issued', 'overdue')
    and paid_amount = 0
    and deleted_at is null
    and (
      due_date is null
      or due_date > current_date
      or monthly_fee_record_id in (
        select id
        from public.monthly_fee_records
        where organization_id = p_organization_id
          and hostel_id = v_hostel_id
          and resident_id = p_resident_id
          and status = 'cancelled'
          and metadata ? 'deactivation_reconciled_at'
      )
    );

  get diagnostics v_cancelled_invoices = row_count;

  update public.residents
  set
    status = 'archived',
    is_active = false,
    deleted_at = now(),
    deleted_by = p_actor_user_id,
    metadata = metadata || jsonb_build_object(
      'deactivation_reconciled_at', now(),
      'released_allocations', v_released_allocations,
      'cancelled_future_fee_records', v_cancelled_fee_records,
      'cancelled_future_invoices', v_cancelled_invoices
    ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_resident_id
    and organization_id = p_organization_id
  returning * into v_resident;

  perform public.recalculate_hostel_capacity(p_organization_id, v_hostel_id);

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
    v_hostel_id,
    p_actor_user_id,
    'residents',
    p_resident_id,
    'resident.deactivate_atomic',
    jsonb_build_object(
      'released_allocations', v_released_allocations,
      'cancelled_future_fee_records', v_cancelled_fee_records,
      'cancelled_future_invoices', v_cancelled_invoices,
      'reason', p_reason
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return v_resident;
end;
$$;

grant execute on function public.deactivate_resident_atomic(uuid, uuid, uuid, text)
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
  end if;

  return new;
end;
$$;

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
    reason = coalesce(ra.reason, 'Consistency repair: allocation no longer has an active resident'),
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
    and (
      r.status <> 'active'
      or r.is_active is not true
      or r.deleted_at is not null
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
      'hostels_recalculated', v_recalculated_hostels
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
