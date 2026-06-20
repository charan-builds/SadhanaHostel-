-- Date of birth is no longer collected during resident onboarding.
-- Keep the existing guarded self-completion workflow unchanged while removing
-- the stale DOB requirement that blocked otherwise complete resident profiles.

begin;

create or replace function public.complete_resident_self_onboarding_atomic(
  p_resident_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_rules_version text
)
returns public.residents
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_resident public.residents%rowtype;
  v_previous_resident public.residents%rowtype;
  v_now timestamptz := now();
begin
  perform public.assert_service_role_rpc('complete_resident_self_onboarding_atomic');

  if p_resident_id is null
     or p_organization_id is null
     or p_actor_user_id is null
     or nullif(trim(coalesce(p_rules_version, '')), '') is null then
    raise exception 'resident_self_onboarding_arguments_required' using errcode = '22023';
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

  v_previous_resident := v_resident;

  if v_resident.user_id is null or v_resident.user_id <> p_actor_user_id then
    raise exception 'resident_self_onboarding_identity_mismatch' using errcode = '42501';
  end if;

  if v_resident.status not in ('draft', 'active')
     or v_resident.onboarding_status = 'suspended'
     or v_resident.is_active is not true
     or v_resident.checkout_on is not null then
    raise exception 'resident_self_onboarding_lifecycle_blocked' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = p_actor_user_id
      and u.organization_id = p_organization_id
      and u.default_role = 'resident'
      and u.is_active is true
      and u.deleted_at is null
  ) then
    raise exception 'resident_self_onboarding_user_access_inactive' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_user_id
      and ur.organization_id = p_organization_id
      and ur.role = 'resident'
      and ur.status = 'active'
      and ur.deleted_at is null
      and (ur.hostel_id is null or ur.hostel_id = v_resident.hostel_id)
      and coalesce(ur.permissions, '[]'::jsonb) @> '["resident.portal.access"]'::jsonb
  ) then
    raise exception 'resident_self_onboarding_portal_access_missing' using errcode = '42501';
  end if;

  if v_resident.onboarding_status = 'verified'
     and v_resident.status = 'active' then
    return v_resident;
  end if;

  if nullif(trim(coalesce(v_resident.full_name, '')), '') is null
     or nullif(trim(coalesce(v_resident.phone, '')), '') is null
     or nullif(trim(coalesce(v_resident.parent_name, '')), '') is null
     or nullif(trim(coalesce(v_resident.parent_phone, '')), '') is null
     or nullif(trim(coalesce(v_resident.emergency_contact_name, '')), '') is null
     or nullif(trim(coalesce(v_resident.emergency_contact_phone, '')), '') is null
     or nullif(trim(coalesce(v_resident.permanent_address, '')), '') is null then
    raise exception 'resident_self_onboarding_profile_incomplete' using errcode = '23514';
  end if;

  perform set_config('app.resident_self_onboarding_completion', 'true', true);

  update public.residents
  set
    status = 'active',
    onboarding_status = 'verified',
    onboarding_rejection_reason = null,
    onboarding_completed_at = coalesce(onboarding_completed_at, v_now),
    onboarding_verified_at = v_now,
    onboarding_verified_by = p_actor_user_id,
    onboarding_metadata = coalesce(onboarding_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'self_completion', true,
        'verificationMode', 'resident_self_completion',
        'verifiedWithoutAdminReviewAt', v_now
      ),
    metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'onboarding',
          coalesce(metadata->'onboarding', '{}'::jsonb)
        ),
      '{onboarding,hostelRulesAcceptance}',
      jsonb_build_object(
        'accepted', true,
        'version', trim(p_rules_version),
        'acceptedAt', v_now,
        'acceptedByUserId', p_actor_user_id
      ),
      true
    ) || jsonb_build_object(
      'profile_completion_required', false,
      'resident_profile_completed_at', v_now
    ),
    updated_by = p_actor_user_id,
    updated_at = v_now
  where id = p_resident_id
    and organization_id = p_organization_id
  returning * into v_resident;

  perform set_config('app.resident_self_onboarding_completion', '', true);

  insert into public.audit_logs (
    organization_id,
    hostel_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    metadata,
    created_by,
    updated_by
  )
  values (
    v_resident.organization_id,
    v_resident.hostel_id,
    p_actor_user_id,
    'residents',
    v_resident.id,
    'resident.self_onboarding_completed',
    jsonb_build_object(
      'status', v_previous_resident.status,
      'onboarding_status', v_previous_resident.onboarding_status,
      'is_active', v_previous_resident.is_active
    ),
    jsonb_build_object(
      'status', v_resident.status,
      'onboarding_status', v_resident.onboarding_status,
      'is_active', v_resident.is_active
    ),
    jsonb_build_object(
      'rules_version', trim(p_rules_version),
      'portal_access_verified', true,
      'completion_mode', 'resident_self_completion'
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return v_resident;
end;
$$;

comment on function public.complete_resident_self_onboarding_atomic(
  uuid, uuid, uuid, text
) is
  'Atomically activates a fully completed, auth-linked resident after verifying active resident portal access. Date of birth is not an onboarding requirement. Callable only by trusted server service-role code.';

revoke execute on function public.complete_resident_self_onboarding_atomic(
  uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.complete_resident_self_onboarding_atomic(
  uuid, uuid, uuid, text
) to service_role;

commit;
