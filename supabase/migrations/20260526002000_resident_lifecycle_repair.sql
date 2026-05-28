-- Resident-scoped lifecycle repair.
-- Gives admins a bounded, tenant-scoped way to repair one stuck resident after
-- interrupted activation, duplicate invites, stale auth linkage, invalid dues,
-- or occupancy residue without opening Supabase manually.

begin;

create or replace function public.repair_resident_lifecycle_atomic(
  p_organization_id uuid,
  p_resident_id uuid,
  p_actor_user_id uuid default auth.uid(),
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := now();
  v_resident public.residents%rowtype;
  v_auth_user auth.users%rowtype;
  v_after_resident public.residents%rowtype;
  v_auth_match_count integer := 0;
  v_expired_invites integer := 0;
  v_duplicate_invites integer := 0;
  v_stale_invites integer := 0;
  v_profiles_synced integer := 0;
  v_roles_synced integer := 0;
  v_auth_link_repaired integer := 0;
  v_onboarding_advanced integer := 0;
  v_allocations_released integer := 0;
  v_fee_records_cancelled integer := 0;
  v_invoices_cancelled integer := 0;
  v_hostels_recalculated integer := 0;
  v_timeline jsonb := '[]'::jsonb;
  v_before jsonb;
  v_correlation_id text := gen_random_uuid()::text;
begin
  if p_organization_id is null or p_resident_id is null then
    raise exception 'resident_lifecycle_repair_arguments_required' using errcode = '22023';
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

  if not (
    public.is_service_context()
    or public.can_manage_organization(v_resident.organization_id, v_resident.hostel_id)
  ) then
    raise exception 'resident_lifecycle_repair_forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_resident.organization_id::text || ':resident-lifecycle-repair:' || v_resident.id::text,
      0
    )
  );

  v_before := jsonb_build_object(
    'residentId', v_resident.id,
    'organizationId', v_resident.organization_id,
    'hostelId', v_resident.hostel_id,
    'status', v_resident.status,
    'onboardingStatus', v_resident.onboarding_status,
    'userId', v_resident.user_id,
    'phone', v_resident.phone,
    'email', v_resident.email,
    'checkoutOn', v_resident.checkout_on
  );

  v_timeline := v_timeline || jsonb_build_array(
    jsonb_build_object(
      'stage', 'resident_locked',
      'at', v_now,
      'correlationId', v_correlation_id,
      'state', v_before
    )
  );

  with auth_matches as (
    select au.*
    from auth.users au
    where
      (v_resident.user_id is not null and au.id = v_resident.user_id)
      or (
        v_resident.email is not null
        and au.email is not null
        and lower(au.email::text) = lower(v_resident.email::text)
      )
      or (
        v_resident.phone is not null
        and au.phone is not null
        and public.normalize_indian_phone(au.phone) = public.normalize_indian_phone(v_resident.phone)
      )
      or au.raw_user_meta_data ->> 'resident_id' = v_resident.id::text
  )
  select count(*)::integer
  into v_auth_match_count
  from auth_matches;

  select au.*
  into v_auth_user
  from auth.users au
  where
    (v_resident.user_id is not null and au.id = v_resident.user_id)
    or (
      v_resident.email is not null
      and au.email is not null
      and lower(au.email::text) = lower(v_resident.email::text)
    )
    or (
      v_resident.phone is not null
      and au.phone is not null
      and public.normalize_indian_phone(au.phone) = public.normalize_indian_phone(v_resident.phone)
    )
    or au.raw_user_meta_data ->> 'resident_id' = v_resident.id::text
  order by
    case when au.id = v_resident.user_id then 0 else 1 end,
    case when au.raw_user_meta_data ->> 'resident_id' = v_resident.id::text then 0 else 1 end,
    au.created_at desc
  limit 1;

  v_timeline := v_timeline || jsonb_build_array(
    jsonb_build_object(
      'stage', 'auth_lookup',
      'at', v_now,
      'correlationId', v_correlation_id,
      'authMatchCount', v_auth_match_count,
      'selectedAuthUserId', v_auth_user.id,
      'repairDecision',
        case
          when v_auth_match_count = 0 then 'no_auth_identity_found'
          when v_auth_match_count = 1 then 'safe_auth_identity_found'
          else 'multiple_auth_identities_manual_review'
        end
    )
  );

  select count(*)::integer
  into v_expired_invites
  from public.resident_invites i
  where i.organization_id = v_resident.organization_id
    and i.resident_id = v_resident.id
    and i.status = 'pending'
    and i.used_at is null
    and i.revoked_at is null
    and i.expires_at <= v_now;

  with ranked_active as (
    select
      i.id,
      row_number() over (
        partition by i.organization_id, i.resident_id
        order by i.created_at desc, i.id desc
      ) as active_rank
    from public.resident_invites i
    where i.organization_id = v_resident.organization_id
      and i.resident_id = v_resident.id
      and i.status = 'pending'
      and i.used_at is null
      and i.revoked_at is null
      and i.expires_at > v_now
  )
  select count(*)::integer
  into v_duplicate_invites
  from ranked_active
  where active_rank > 1;

  select count(*)::integer
  into v_stale_invites
  from public.resident_invites i
  where i.organization_id = v_resident.organization_id
    and i.resident_id = v_resident.id
    and i.status = 'pending'
    and i.used_at is null
    and i.revoked_at is null
    and v_resident.user_id is not null;

  select count(*)::integer
  into v_allocations_released
  from public.room_allocations ra
  where ra.organization_id = v_resident.organization_id
    and ra.resident_id = v_resident.id
    and ra.status = 'active'
    and ra.deleted_at is null
    and not public.is_resident_operational_for_bed(
      v_resident.status,
      v_resident.is_active,
      v_resident.user_id,
      v_resident.checkout_on,
      v_resident.onboarding_status,
      v_resident.deleted_at
    );

  select count(*)::integer
  into v_fee_records_cancelled
  from public.monthly_fee_records mfr
  where mfr.organization_id = v_resident.organization_id
    and mfr.resident_id = v_resident.id
    and mfr.status in ('pending', 'overdue')
    and mfr.paid_amount = 0
    and mfr.deleted_at is null
    and not public.is_resident_operational_for_bed(
      v_resident.status,
      v_resident.is_active,
      v_resident.user_id,
      v_resident.checkout_on,
      v_resident.onboarding_status,
      v_resident.deleted_at
    );

  select count(*)::integer
  into v_invoices_cancelled
  from public.invoices inv
  join public.monthly_fee_records mfr
    on mfr.id = inv.monthly_fee_record_id
   and mfr.organization_id = inv.organization_id
  where inv.organization_id = v_resident.organization_id
    and mfr.resident_id = v_resident.id
    and inv.status in ('draft', 'issued', 'overdue')
    and inv.paid_amount = 0
    and inv.deleted_at is null
    and not public.is_resident_operational_for_bed(
      v_resident.status,
      v_resident.is_active,
      v_resident.user_id,
      v_resident.checkout_on,
      v_resident.onboarding_status,
      v_resident.deleted_at
    );

  v_timeline := v_timeline || jsonb_build_array(
    jsonb_build_object(
      'stage', 'repair_plan',
      'at', v_now,
      'correlationId', v_correlation_id,
      'dryRun', p_dry_run,
      'wouldExpireInvites', v_expired_invites,
      'wouldRevokeDuplicateInvites', v_duplicate_invites,
      'wouldRevokeStaleInvites', v_stale_invites,
      'wouldReleaseAllocations', v_allocations_released,
      'wouldCancelFeeRecords', v_fee_records_cancelled,
      'wouldCancelInvoices', v_invoices_cancelled
    )
  );

  if p_dry_run then
    return jsonb_build_object(
      'dryRun', true,
      'correlationId', v_correlation_id,
      'residentId', v_resident.id,
      'organizationId', v_resident.organization_id,
      'hostelId', v_resident.hostel_id,
      'authMatchCount', v_auth_match_count,
      'selectedAuthUserId', v_auth_user.id,
      'repairs', jsonb_build_object(
        'expiredInvites', v_expired_invites,
        'duplicateInvitesRevoked', v_duplicate_invites,
        'staleInvitesRevoked', v_stale_invites,
        'authLinkRepaired', case when v_resident.user_id is null and v_auth_match_count = 1 then 1 else 0 end,
        'profilesSynced', case when v_auth_match_count = 1 then 1 else 0 end,
        'rolesSynced', case when v_auth_match_count = 1 then 1 else 0 end,
        'onboardingAdvanced', case when v_resident.user_id is not null and v_resident.status = 'draft' and v_resident.onboarding_status in ('invited', 'rejected') then 1 else 0 end,
        'allocationsReleased', v_allocations_released,
        'feeRecordsCancelled', v_fee_records_cancelled,
        'invoicesCancelled', v_invoices_cancelled,
        'hostelsRecalculated', case when v_allocations_released > 0 then 1 else 0 end
      ),
      'timeline', v_timeline
    );
  end if;

  update public.resident_invites i
  set
    status = 'expired',
    updated_at = v_now,
    updated_by = p_actor_user_id,
    metadata = coalesce(i.metadata, '{}'::jsonb)
      || jsonb_build_object('repair_reason', 'resident_lifecycle_expired_invite')
  where i.organization_id = v_resident.organization_id
    and i.resident_id = v_resident.id
    and i.status = 'pending'
    and i.used_at is null
    and i.revoked_at is null
    and i.expires_at <= v_now;

  with ranked_active as (
    select
      i.id,
      row_number() over (
        partition by i.organization_id, i.resident_id
        order by i.created_at desc, i.id desc
      ) as active_rank
    from public.resident_invites i
    where i.organization_id = v_resident.organization_id
      and i.resident_id = v_resident.id
      and i.status = 'pending'
      and i.used_at is null
      and i.revoked_at is null
      and i.expires_at > v_now
  )
  update public.resident_invites i
  set
    status = 'revoked',
    revoked_at = v_now,
    updated_at = v_now,
    updated_by = p_actor_user_id,
    metadata = coalesce(i.metadata, '{}'::jsonb)
      || jsonb_build_object('repair_reason', 'resident_lifecycle_duplicate_invite')
  from ranked_active c
  where i.id = c.id
    and c.active_rank > 1;

  update public.resident_invites i
  set
    status = 'revoked',
    revoked_at = v_now,
    updated_at = v_now,
    updated_by = p_actor_user_id,
    metadata = coalesce(i.metadata, '{}'::jsonb)
      || jsonb_build_object('repair_reason', 'resident_lifecycle_resident_already_linked')
  where i.organization_id = v_resident.organization_id
    and i.resident_id = v_resident.id
    and i.status = 'pending'
    and i.used_at is null
    and i.revoked_at is null
    and v_resident.user_id is not null;

  if v_resident.user_id is null and v_auth_match_count = 1 and v_auth_user.id is not null then
    update public.residents
    set
      user_id = v_auth_user.id,
      onboarding_status = case
        when onboarding_status in ('invited', 'rejected') then 'activated'::public.resident_onboarding_status_enum
        else onboarding_status
      end,
      onboarding_metadata = coalesce(onboarding_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'resident_lifecycle_repaired_at', v_now,
          'repair_action', 'auth_link_repaired',
          'previous_user_id', null
        ),
      updated_at = v_now,
      updated_by = p_actor_user_id
    where id = v_resident.id
      and organization_id = v_resident.organization_id;

    get diagnostics v_auth_link_repaired = row_count;
  end if;

  select *
  into v_after_resident
  from public.residents
  where id = v_resident.id
    and organization_id = v_resident.organization_id
  for update;

  if v_auth_match_count = 1 and v_auth_user.id is not null then
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
    values (
      v_auth_user.id,
      v_after_resident.organization_id,
      coalesce(
        nullif(trim(v_auth_user.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(v_auth_user.raw_user_meta_data ->> 'name'), ''),
        v_after_resident.full_name,
        'Resident User'
      ),
      coalesce(v_auth_user.email::text, v_after_resident.email::text),
      coalesce(v_auth_user.phone, v_after_resident.phone),
      'resident'::public.user_role_enum,
      true,
      coalesce(v_auth_user.raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'source', 'resident_lifecycle_repair',
          'resident_id', v_after_resident.id,
          'hostel_id', v_after_resident.hostel_id,
          'last_auth_linkage_resync_at', v_now
        ),
      p_actor_user_id,
      p_actor_user_id
    )
    on conflict (id) do update
    set
      organization_id = excluded.organization_id,
      full_name = coalesce(excluded.full_name, public.users.full_name),
      email = coalesce(excluded.email, public.users.email),
      phone = coalesce(excluded.phone, public.users.phone),
      default_role = 'resident',
      is_active = true,
      metadata = coalesce(public.users.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'resident_id', v_after_resident.id,
          'hostel_id', v_after_resident.hostel_id,
          'last_auth_linkage_resync_at', v_now
        ),
      updated_at = v_now,
      updated_by = p_actor_user_id;

    get diagnostics v_profiles_synced = row_count;

    insert into public.user_roles (
      organization_id,
      hostel_id,
      user_id,
      role,
      permissions,
      status,
      accepted_at,
      created_by,
      updated_by
    )
    values (
      v_after_resident.organization_id,
      v_after_resident.hostel_id,
      v_auth_user.id,
      'resident',
      jsonb_build_array('resident.portal.access'),
      'active',
      v_now,
      p_actor_user_id,
      p_actor_user_id
    )
    on conflict (
      organization_id,
      coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
      user_id,
      role
    )
    where deleted_at is null
    do update
    set
      permissions = excluded.permissions,
      status = 'active',
      accepted_at = coalesce(public.user_roles.accepted_at, v_now),
      updated_at = v_now,
      updated_by = p_actor_user_id;

    get diagnostics v_roles_synced = row_count;
  end if;

  update public.residents r
  set
    onboarding_status = 'activated',
    onboarding_metadata = coalesce(r.onboarding_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'resident_lifecycle_repaired_at', v_now,
        'repair_action', 'onboarding_advanced',
        'previous_onboarding_status', r.onboarding_status
      ),
    updated_at = v_now,
    updated_by = p_actor_user_id
  where r.id = v_resident.id
    and r.organization_id = v_resident.organization_id
    and r.user_id is not null
    and r.status = 'draft'
    and r.onboarding_status in ('invited', 'rejected')
    and r.deleted_at is null;

  get diagnostics v_onboarding_advanced = row_count;

  if not public.is_resident_operational_for_bed(
    v_after_resident.status,
    v_after_resident.is_active,
    v_after_resident.user_id,
    v_after_resident.checkout_on,
    v_after_resident.onboarding_status,
    v_after_resident.deleted_at
  ) then
    update public.room_allocations ra
    set
      status = 'completed',
      allocated_to = coalesce(allocated_to, greatest(current_date, allocated_from)),
      reason = coalesce(reason, 'Released by resident lifecycle repair.'),
      updated_at = v_now,
      updated_by = p_actor_user_id
    where ra.organization_id = v_after_resident.organization_id
      and ra.resident_id = v_after_resident.id
      and ra.status = 'active'
      and ra.deleted_at is null;

    get diagnostics v_allocations_released = row_count;

    update public.monthly_fee_records mfr
    set
      status = 'cancelled',
      balance_amount = 0,
      notes = concat_ws(E'\n', mfr.notes, 'Cancelled by resident lifecycle repair for non-operational resident.'),
      metadata = coalesce(mfr.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'resident_lifecycle_repaired_at', v_now,
          'previous_balance_amount', mfr.balance_amount
        ),
      updated_at = v_now,
      updated_by = p_actor_user_id
    where mfr.organization_id = v_after_resident.organization_id
      and mfr.resident_id = v_after_resident.id
      and mfr.status in ('pending', 'overdue')
      and mfr.paid_amount = 0
      and mfr.deleted_at is null;

    get diagnostics v_fee_records_cancelled = row_count;

    update public.invoices inv
    set
      status = 'cancelled',
      balance_amount = 0,
      cancelled_at = v_now,
      cancelled_by = p_actor_user_id,
      cancellation_reason = coalesce(
        inv.cancellation_reason,
        'Cancelled by resident lifecycle repair for non-operational resident.'
      ),
      metadata = coalesce(inv.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'resident_lifecycle_repaired_at', v_now,
          'previous_balance_amount', inv.balance_amount
        ),
      updated_at = v_now,
      updated_by = p_actor_user_id
    from public.monthly_fee_records mfr
    where inv.organization_id = v_after_resident.organization_id
      and inv.monthly_fee_record_id = mfr.id
      and mfr.resident_id = v_after_resident.id
      and inv.status in ('draft', 'issued', 'overdue')
      and inv.paid_amount = 0
      and inv.deleted_at is null;

    get diagnostics v_invoices_cancelled = row_count;
  end if;

  if v_allocations_released > 0 then
    perform public.recalculate_hostel_capacity(v_after_resident.hostel_id);
    v_hostels_recalculated := 1;
  end if;

  select *
  into v_after_resident
  from public.residents
  where id = v_resident.id
    and organization_id = v_resident.organization_id;

  v_timeline := v_timeline || jsonb_build_array(
    jsonb_build_object(
      'stage', 'repair_applied',
      'at', v_now,
      'correlationId', v_correlation_id,
      'after', jsonb_build_object(
        'status', v_after_resident.status,
        'onboardingStatus', v_after_resident.onboarding_status,
        'userId', v_after_resident.user_id,
        'checkoutOn', v_after_resident.checkout_on
      )
    )
  );

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
    v_after_resident.organization_id,
    v_after_resident.hostel_id,
    p_actor_user_id,
    'residents',
    v_after_resident.id,
    'resident.lifecycle_repair',
    jsonb_build_object(
      'dry_run', false,
      'correlation_id', v_correlation_id,
      'before', v_before,
      'auth_match_count', v_auth_match_count,
      'selected_auth_user_id', v_auth_user.id,
      'repairs', jsonb_build_object(
        'expired_invites', v_expired_invites,
        'duplicate_invites_revoked', v_duplicate_invites,
        'stale_invites_revoked', v_stale_invites,
        'auth_link_repaired', v_auth_link_repaired,
        'profiles_synced', v_profiles_synced,
        'roles_synced', v_roles_synced,
        'onboarding_advanced', v_onboarding_advanced,
        'allocations_released', v_allocations_released,
        'fee_records_cancelled', v_fee_records_cancelled,
        'invoices_cancelled', v_invoices_cancelled,
        'hostels_recalculated', v_hostels_recalculated
      ),
      'timeline', v_timeline
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'dryRun', false,
    'correlationId', v_correlation_id,
    'residentId', v_after_resident.id,
    'organizationId', v_after_resident.organization_id,
    'hostelId', v_after_resident.hostel_id,
    'authMatchCount', v_auth_match_count,
    'selectedAuthUserId', v_auth_user.id,
    'repairs', jsonb_build_object(
      'expiredInvites', v_expired_invites,
      'duplicateInvitesRevoked', v_duplicate_invites,
      'staleInvitesRevoked', v_stale_invites,
      'authLinkRepaired', v_auth_link_repaired,
      'profilesSynced', v_profiles_synced,
      'rolesSynced', v_roles_synced,
      'onboardingAdvanced', v_onboarding_advanced,
      'allocationsReleased', v_allocations_released,
      'feeRecordsCancelled', v_fee_records_cancelled,
      'invoicesCancelled', v_invoices_cancelled,
      'hostelsRecalculated', v_hostels_recalculated
    ),
    'timeline', v_timeline
  );
end;
$$;

revoke execute on function public.repair_resident_lifecycle_atomic(uuid, uuid, uuid, boolean)
  from public, anon;

grant execute on function public.repair_resident_lifecycle_atomic(uuid, uuid, uuid, boolean)
  to authenticated, service_role;

comment on function public.repair_resident_lifecycle_atomic(uuid, uuid, uuid, boolean) is
  'Tenant-scoped resident lifecycle repair for partial activation, auth linkage, duplicate invites, stale occupancy, and invalid dues. Supports dry-run diagnostics.';

commit;
