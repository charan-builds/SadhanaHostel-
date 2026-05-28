-- Activation state-machine recovery hardening.
-- Makes resident invite activation retry-safe, diagnosable, and explicit about
-- lifecycle states that require admin repair instead of emitting a generic
-- bootstrap trigger failure.

begin;

create or replace function public.protect_resident_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_protected_changed boolean;
begin
  if current_setting('app.resident_activation_bootstrap', true) = 'true' then
    v_protected_changed := (
      to_jsonb(new)
        - 'user_id'
        - 'onboarding_status'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
        - 'search_vector'
    ) is distinct from (
      to_jsonb(old)
        - 'user_id'
        - 'onboarding_status'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
        - 'search_vector'
    );

    if new.deleted_at is not null then
      raise exception 'resident_activation_deleted' using errcode = '23514';
    end if;

    if new.checkout_on is not null then
      raise exception 'resident_activation_checked_out' using errcode = '23514';
    end if;

    if new.status in ('suspended', 'checked_out', 'archived') then
      raise exception 'resident_activation_blocked_status:%', new.status using errcode = '23514';
    end if;

    if new.onboarding_status = 'suspended'::public.resident_onboarding_status_enum then
      raise exception 'resident_activation_blocked_onboarding_status:%', new.onboarding_status using errcode = '23514';
    end if;

    if not v_protected_changed
       and (old.user_id is null or old.user_id = new.user_id)
       and new.user_id is not null
       and new.onboarding_status in (
          'invited'::public.resident_onboarding_status_enum,
          'activated'::public.resident_onboarding_status_enum,
          'profile_incomplete'::public.resident_onboarding_status_enum,
          'documents_pending'::public.resident_onboarding_status_enum,
          'verification_pending'::public.resident_onboarding_status_enum,
          'verified'::public.resident_onboarding_status_enum,
          'rejected'::public.resident_onboarding_status_enum
       ) then
      return new;
    end if;

    raise exception
      'resident_activation_bootstrap_invalid_transition: status=%, onboarding_status=%, old_user_id=%, new_user_id=%, protected_changed=%',
      new.status,
      new.onboarding_status,
      old.user_id,
      new.user_id,
      v_protected_changed
      using errcode = '23514';
  end if;

  if public.is_service_context() or public.can_manage_organization(old.organization_id, old.hostel_id) then
    return new;
  end if;

  if public.owns_resident(old.id) then
    if (
      new.organization_id,
      new.hostel_id,
      new.user_id,
      new.parent_user_id,
      new.resident_type,
      new.admission_number,
      new.aadhaar_last4,
      new.aadhaar_document_id,
      new.profile_image_document_id,
      new.status,
      new.joined_on,
      new.checkout_on,
      new.monthly_fee_amount,
      new.security_deposit_amount,
      new.deleted_at,
      new.deleted_by
    ) is distinct from (
      old.organization_id,
      old.hostel_id,
      old.user_id,
      old.parent_user_id,
      old.resident_type,
      old.admission_number,
      old.aadhaar_last4,
      old.aadhaar_document_id,
      old.profile_image_document_id,
      old.status,
      old.joined_on,
      old.checkout_on,
      old.monthly_fee_amount,
      old.security_deposit_amount,
      old.deleted_at,
      old.deleted_by
    ) then
      raise exception 'Residents cannot update protected profile fields';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update resident profile';
end;
$$;

create or replace function public.activate_resident_invite_atomic(
  p_invite_id uuid,
  p_invite_token_hash text,
  p_auth_user_id uuid
)
returns public.residents
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite public.resident_invites%rowtype;
  v_resident public.residents%rowtype;
  v_auth_user record;
  v_now timestamptz := now();
  v_display_name text;
  v_previous_onboarding_status public.resident_onboarding_status_enum;
begin
  if p_invite_id is null or nullif(trim(coalesce(p_invite_token_hash, '')), '') is null or p_auth_user_id is null then
    raise exception 'activation_arguments_required' using errcode = '22023';
  end if;

  select *
  into v_invite
  from public.resident_invites
  where id = p_invite_id
    and invite_token_hash = p_invite_token_hash
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  if v_invite.status = 'used' and v_invite.used_at is not null then
    select *
    into v_resident
    from public.residents
    where id = v_invite.resident_id
      and organization_id = v_invite.organization_id
      and hostel_id = v_invite.hostel_id
      and user_id = p_auth_user_id
      and deleted_at is null;

    if found then
      return v_resident;
    end if;

    raise exception 'invite_already_used' using errcode = '23505';
  end if;

  if v_invite.status = 'revoked' or v_invite.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = '23505';
  end if;

  if v_invite.status = 'expired' then
    raise exception 'invite_expired' using errcode = '22023';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'invite_not_pending:%', v_invite.status using errcode = '23514';
  end if;

  if v_invite.expires_at <= v_now then
    update public.resident_invites
    set
      status = 'expired',
      updated_at = v_now
    where id = v_invite.id;

    raise exception 'invite_expired' using errcode = '22023';
  end if;

  select *
  into v_resident
  from public.residents
  where id = v_invite.resident_id
    and organization_id = v_invite.organization_id
    and hostel_id = v_invite.hostel_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'resident_not_found' using errcode = 'P0002';
  end if;

  if v_resident.status in ('suspended', 'checked_out', 'archived') then
    raise exception 'resident_activation_blocked_status:%', v_resident.status using errcode = '23514';
  end if;

  if v_resident.checkout_on is not null then
    raise exception 'resident_activation_checked_out' using errcode = '23514';
  end if;

  if v_resident.onboarding_status = 'suspended'::public.resident_onboarding_status_enum then
    raise exception 'resident_activation_blocked_onboarding_status:%', v_resident.onboarding_status using errcode = '23514';
  end if;

  if v_resident.user_id is not null and v_resident.user_id <> p_auth_user_id then
    raise exception 'resident_already_linked' using errcode = '23505';
  end if;

  select
    au.id,
    au.email,
    au.phone,
    au.raw_user_meta_data
  into v_auth_user
  from auth.users au
  where au.id = p_auth_user_id;

  if v_auth_user.id is null then
    raise exception 'auth_user_not_found' using errcode = 'P0002';
  end if;

  if not (
    (
      v_invite.email is not null
      and v_auth_user.email is not null
      and lower(v_auth_user.email::text) = lower(v_invite.email::text)
    )
    or public.phone_numbers_match(v_auth_user.phone, v_invite.phone)
  ) then
    raise exception 'invite_identity_mismatch' using errcode = '42501';
  end if;

  v_previous_onboarding_status := v_resident.onboarding_status;
  v_display_name := nullif(trim(coalesce(
    v_auth_user.raw_user_meta_data ->> 'full_name',
    v_auth_user.raw_user_meta_data ->> 'name',
    v_resident.full_name,
    split_part(coalesce(v_auth_user.email, ''), '@', 1),
    coalesce(v_auth_user.phone, '')
  )), '');

  insert into public.users (
    id,
    full_name,
    email,
    phone,
    organization_id,
    default_role,
    is_active,
    metadata,
    created_by,
    updated_by
  )
  values (
    p_auth_user_id,
    coalesce(v_display_name, v_resident.full_name, 'Resident User'),
    v_auth_user.email,
    v_auth_user.phone,
    v_resident.organization_id,
    'resident',
    true,
    jsonb_build_object(
      'source', 'resident_invite_activation',
      'resident_id', v_resident.id,
      'hostel_id', v_resident.hostel_id,
      'activated_at', v_now,
      'resident_identity_mode', case
        when v_invite.email is not null and v_invite.phone is not null then 'email_and_phone'
        when v_invite.email is not null then 'email'
        else 'phone'
      end
    ),
    p_auth_user_id,
    p_auth_user_id
  )
  on conflict (id) do update
  set
    full_name = coalesce(nullif(excluded.full_name, 'Resident User'), public.users.full_name),
    email = excluded.email,
    phone = excluded.phone,
    organization_id = v_resident.organization_id,
    default_role = 'resident',
    is_active = true,
    metadata = coalesce(public.users.metadata, '{}'::jsonb) || jsonb_build_object(
      'resident_id', v_resident.id,
      'hostel_id', v_resident.hostel_id,
      'last_resident_activation_at', v_now,
      'resident_identity_mode', case
        when v_invite.email is not null and v_invite.phone is not null then 'email_and_phone'
        when v_invite.email is not null then 'email'
        else 'phone'
      end
    ),
    updated_at = v_now,
    updated_by = p_auth_user_id;

  perform set_config('app.resident_activation_bootstrap', 'true', true);

  update public.residents
  set
    user_id = p_auth_user_id,
    onboarding_status = case
      when onboarding_status in ('invited', 'rejected') then 'activated'::public.resident_onboarding_status_enum
      else onboarding_status
    end,
    onboarding_metadata = coalesce(onboarding_metadata, '{}'::jsonb) || jsonb_build_object(
      'activation', jsonb_build_object(
        'invite_id', v_invite.id,
        'activated_at', v_now,
        'auth_user_id', p_auth_user_id,
        'phone_first_access', true,
        'previous_onboarding_status', v_previous_onboarding_status,
        'state_machine', 'activation_completed'
      )
    ),
    updated_at = v_now,
    updated_by = p_auth_user_id
  where id = v_resident.id
    and organization_id = v_resident.organization_id
  returning * into v_resident;

  perform set_config('app.resident_activation_bootstrap', '', true);

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
    v_resident.organization_id,
    v_resident.hostel_id,
    p_auth_user_id,
    'resident',
    jsonb_build_array('resident.portal.access'),
    'active',
    v_now,
    p_auth_user_id,
    p_auth_user_id
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
    updated_by = p_auth_user_id;

  update public.resident_invites
  set
    status = 'used',
    used_at = v_now,
    updated_at = v_now,
    updated_by = p_auth_user_id,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'auth_linkage_state', 'linked',
        'activation_lifecycle_state', 'onboarding_in_progress',
        'phone_verified', v_invite.phone is not null and public.phone_numbers_match(v_auth_user.phone, v_invite.phone),
        'email_verified', v_invite.email is not null and v_auth_user.email is not null and lower(v_auth_user.email::text) = lower(v_invite.email::text)
      )
  where id = v_invite.id
    and status = 'pending'
    and used_at is null
    and revoked_at is null;

  update public.resident_invites
  set
    status = 'revoked',
    revoked_at = v_now,
    updated_at = v_now,
    updated_by = p_auth_user_id,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('activation_lifecycle_state', 'superseded')
  where organization_id = v_invite.organization_id
    and resident_id = v_invite.resident_id
    and id <> v_invite.id
    and status = 'pending'
    and used_at is null
    and revoked_at is null;

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
    p_auth_user_id,
    'residents',
    v_resident.id,
    'resident.activation_bootstrap',
    null,
    to_jsonb(v_resident),
    jsonb_build_object(
      'invite_id', v_invite.id,
      'invite_code', v_invite.invite_code,
      'auth_user_id', p_auth_user_id,
      'phone_first_access', true,
      'previous_onboarding_status', v_previous_onboarding_status,
      'next_onboarding_status', v_resident.onboarding_status
    ),
    p_auth_user_id,
    p_auth_user_id
  );

  return v_resident;
exception
  when others then
    perform set_config('app.resident_activation_bootstrap', '', true);
    raise;
end;
$$;

comment on function public.activate_resident_invite_atomic(uuid, text, uuid) is
  'Service-role-only activation bootstrap. Idempotently links resident auth, emits explicit lifecycle errors, marks invite used, revokes duplicates, and writes audit logs.';

revoke execute on function public.activate_resident_invite_atomic(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_resident_invite_atomic(uuid, text, uuid)
  to service_role;

commit;
