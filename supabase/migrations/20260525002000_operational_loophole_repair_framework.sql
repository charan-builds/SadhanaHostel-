-- Final operational loophole repair framework.
-- Adds bounded, tenant-guarded repairs for invite/auth lifecycle, analytics
-- snapshots, and invalid dues created before lifecycle hardening.

begin;

create or replace function public.repair_onboarding_access_consistency_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_limit integer default 500,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_expired_count integer := 0;
  v_activated_revoked_count integer := 0;
  v_duplicate_revoked_count integer := 0;
  v_auth_profiles_synced_count integer := 0;
  v_deadlock_residents_advanced_count integer := 0;
begin
  if not public.can_manage_organization(p_organization_id, p_hostel_id) then
    raise exception 'onboarding_access_repair_forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':onboarding-access:' || coalesce(p_hostel_id::text, 'all'),
      0
    )
  );

  with expired_candidates as (
    select i.id
    from public.resident_invites i
    where i.organization_id = p_organization_id
      and (p_hostel_id is null or i.hostel_id = p_hostel_id)
      and i.status = 'pending'
      and i.used_at is null
      and i.revoked_at is null
      and i.expires_at <= now()
    order by i.expires_at asc
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  ),
  expired as (
    update public.resident_invites i
    set
      status = 'expired',
      updated_at = now(),
      updated_by = p_actor_user_id
    from expired_candidates c
    where i.id = c.id
    returning i.id
  )
  select count(*)::integer into v_expired_count from expired;

  with activated_candidates as (
    select i.id
    from public.resident_invites i
    join public.residents r
      on r.id = i.resident_id
     and r.organization_id = i.organization_id
     and r.hostel_id = i.hostel_id
    where i.organization_id = p_organization_id
      and (p_hostel_id is null or i.hostel_id = p_hostel_id)
      and i.status = 'pending'
      and i.used_at is null
      and i.revoked_at is null
      and r.user_id is not null
      and r.deleted_at is null
    order by i.created_at asc
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  ),
  activated_revoked as (
    update public.resident_invites i
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now(),
      updated_by = p_actor_user_id,
      metadata = coalesce(i.metadata, '{}'::jsonb)
        || jsonb_build_object('repair_reason', 'resident_already_has_auth_user')
    from activated_candidates c
    where i.id = c.id
    returning i.id
  )
  select count(*)::integer into v_activated_revoked_count from activated_revoked;

  with ranked_active as (
    select
      i.id,
      row_number() over (
        partition by i.organization_id, i.resident_id
        order by i.created_at desc, i.id desc
      ) as active_rank
    from public.resident_invites i
    where i.organization_id = p_organization_id
      and (p_hostel_id is null or i.hostel_id = p_hostel_id)
      and i.status = 'pending'
      and i.used_at is null
      and i.revoked_at is null
      and i.expires_at > now()
  ),
  duplicate_candidates as (
    select id
    from ranked_active
    where active_rank > 1
    limit greatest(coalesce(p_limit, 500), 1)
  ),
  duplicate_revoked as (
    update public.resident_invites i
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now(),
      updated_by = p_actor_user_id,
      metadata = coalesce(i.metadata, '{}'::jsonb)
        || jsonb_build_object('repair_reason', 'duplicate_active_invite')
    from duplicate_candidates c
    where i.id = c.id
    returning i.id
  )
  select count(*)::integer into v_duplicate_revoked_count from duplicate_revoked;

  with linked_residents as (
    select
      r.id as resident_id,
      r.user_id,
      r.organization_id,
      r.hostel_id,
      r.full_name,
      r.email as resident_email,
      r.phone as resident_phone,
      au.email as auth_email,
      au.phone as auth_phone,
      au.raw_user_meta_data
    from public.residents r
    join auth.users au
      on au.id = r.user_id
    where r.organization_id = p_organization_id
      and (p_hostel_id is null or r.hostel_id = p_hostel_id)
      and r.user_id is not null
      and r.deleted_at is null
    order by r.updated_at desc
    limit greatest(coalesce(p_limit, 500), 1)
  ),
  synced_profiles as (
    insert into public.users (
      id,
      organization_id,
      full_name,
      email,
      phone,
      default_role,
      is_active,
      metadata,
      created_by,
      updated_by
    )
    select
      lr.user_id,
      lr.organization_id,
      coalesce(
        nullif(trim(lr.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(lr.raw_user_meta_data ->> 'name'), ''),
        lr.full_name,
        'Resident User'
      ),
      coalesce(lr.auth_email::text, lr.resident_email::text),
      coalesce(lr.auth_phone, lr.resident_phone),
      'resident'::public.user_role_enum,
      true,
      jsonb_build_object(
        'source', 'operational_consistency_repair',
        'resident_id', lr.resident_id,
        'hostel_id', lr.hostel_id,
        'resynced_at', now()
      ),
      p_actor_user_id,
      p_actor_user_id
    from linked_residents lr
    on conflict (id) do update
    set
      organization_id = excluded.organization_id,
      full_name = coalesce(nullif(excluded.full_name, 'Resident User'), public.users.full_name),
      email = coalesce(excluded.email, public.users.email),
      phone = coalesce(excluded.phone, public.users.phone),
      default_role = 'resident',
      is_active = true,
      metadata = coalesce(public.users.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'resident_id', excluded.metadata ->> 'resident_id',
          'hostel_id', excluded.metadata ->> 'hostel_id',
          'last_auth_linkage_resync_at', now()
        ),
      updated_by = p_actor_user_id,
      updated_at = now()
    returning id
  )
  select count(*)::integer into v_auth_profiles_synced_count from synced_profiles;

  update public.residents r
  set
    onboarding_status = 'activated',
    onboarding_metadata = coalesce(r.onboarding_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'access_repair_advanced_at', now(),
        'previous_onboarding_status', r.onboarding_status
      ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where r.organization_id = p_organization_id
    and (p_hostel_id is null or r.hostel_id = p_hostel_id)
    and r.user_id is not null
    and r.status = 'draft'
    and r.onboarding_status in ('invited', 'rejected')
    and r.deleted_at is null;

  get diagnostics v_deadlock_residents_advanced_count = row_count;

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
    'resident_invites',
    null,
    'onboarding_access.consistency_repair',
    jsonb_build_object(
      'expired_count', v_expired_count,
      'activated_invites_revoked_count', v_activated_revoked_count,
      'duplicate_invites_revoked_count', v_duplicate_revoked_count,
      'auth_profiles_synced_count', v_auth_profiles_synced_count,
      'deadlock_residents_advanced_count', v_deadlock_residents_advanced_count
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'expiredCount', v_expired_count,
    'activatedInvitesRevokedCount', v_activated_revoked_count,
    'duplicateInvitesRevokedCount', v_duplicate_revoked_count,
    'authProfilesSyncedCount', v_auth_profiles_synced_count,
    'deadlockResidentsAdvancedCount', v_deadlock_residents_advanced_count
  );
end;
$$;

grant execute on function public.repair_onboarding_access_consistency_atomic(uuid, uuid, integer, uuid)
  to authenticated, service_role;

create or replace function public.reconcile_invalid_dues_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_limit integer default 500,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_fee_records_cancelled integer := 0;
  v_invoices_cancelled integer := 0;
begin
  if not public.can_manage_finance(p_organization_id, p_hostel_id) then
    raise exception 'dues_reconciliation_forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':dues-reconcile:' || coalesce(p_hostel_id::text, 'all'),
      0
    )
  );

  with invalid_fee_records as (
    select mfr.id
    from public.monthly_fee_records mfr
    join public.residents r
      on r.id = mfr.resident_id
     and r.organization_id = mfr.organization_id
    where mfr.organization_id = p_organization_id
      and (p_hostel_id is null or mfr.hostel_id = p_hostel_id)
      and mfr.status in ('pending', 'overdue')
      and mfr.paid_amount = 0
      and mfr.deleted_at is null
      and r.deleted_at is null
      and not public.is_resident_operational_for_bed(
        r.status,
        r.is_active,
        r.user_id,
        r.checkout_on,
        r.onboarding_status,
        r.deleted_at
      )
    order by mfr.period_month desc, mfr.created_at desc
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  ),
  cancelled_fee_records as (
    update public.monthly_fee_records mfr
    set
      status = 'cancelled',
      balance_amount = 0,
      notes = concat_ws(E'\n', mfr.notes, 'Cancelled by operational consistency dues reconciliation.'),
      metadata = coalesce(mfr.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'dues_consistency_reconciled_at', now(),
          'previous_balance_amount', mfr.balance_amount
        ),
      updated_by = p_actor_user_id,
      updated_at = now()
    from invalid_fee_records c
    where mfr.id = c.id
    returning mfr.id
  )
  select count(*)::integer into v_fee_records_cancelled from cancelled_fee_records;

  update public.invoices inv
  set
    status = 'cancelled',
    balance_amount = 0,
    cancelled_at = now(),
    cancelled_by = p_actor_user_id,
    cancellation_reason = coalesce(
      inv.cancellation_reason,
      'Cancelled by operational consistency dues reconciliation.'
    ),
    metadata = coalesce(inv.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'dues_consistency_reconciled_at', now(),
        'previous_balance_amount', inv.balance_amount
      ),
    updated_by = p_actor_user_id,
    updated_at = now()
  where inv.organization_id = p_organization_id
    and (p_hostel_id is null or inv.hostel_id = p_hostel_id)
    and inv.status in ('draft', 'issued', 'overdue')
    and inv.paid_amount = 0
    and inv.deleted_at is null
    and exists (
      select 1
      from public.monthly_fee_records mfr
      where mfr.id = inv.monthly_fee_record_id
        and mfr.organization_id = inv.organization_id
        and mfr.status = 'cancelled'
        and mfr.metadata ? 'dues_consistency_reconciled_at'
    );

  get diagnostics v_invoices_cancelled = row_count;

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
    'monthly_fee_records',
    null,
    'dues.consistency_reconciliation',
    jsonb_build_object(
      'fee_records_cancelled', v_fee_records_cancelled,
      'invoices_cancelled', v_invoices_cancelled,
      'policy', 'unpaid pending/overdue dues for non-operational residents only'
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'feeRecordsCancelled', v_fee_records_cancelled,
    'invoicesCancelled', v_invoices_cancelled
  );
end;
$$;

grant execute on function public.reconcile_invalid_dues_atomic(uuid, uuid, integer, uuid)
  to authenticated, service_role;

create or replace function public.repair_analytics_consistency_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recalculated_hostels integer := 0;
  v_hostel record;
begin
  if not public.can_manage_organization(p_organization_id, p_hostel_id) then
    raise exception 'analytics_repair_forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':analytics-repair:' || coalesce(p_hostel_id::text, 'all'),
      0
    )
  );

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
    'hostel_capacity',
    null,
    'analytics.consistency_repair',
    jsonb_build_object('hostels_recalculated', v_recalculated_hostels),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object('hostelsRecalculated', v_recalculated_hostels);
end;
$$;

grant execute on function public.repair_analytics_consistency_atomic(uuid, uuid, uuid)
  to authenticated, service_role;

commit;
