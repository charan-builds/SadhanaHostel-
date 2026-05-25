-- Resident invite activation bootstrap hardening.
-- Activation must bind the resident to the newly created Supabase Auth user
-- before normal resident-owned RLS paths are expected to work.

begin;

create or replace function public.protect_resident_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if current_setting('app.resident_activation_bootstrap', true) = 'true' then
    if (
      to_jsonb(new)
        - 'user_id'
        - 'onboarding_status'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
    ) = (
      to_jsonb(old)
        - 'user_id'
        - 'onboarding_status'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
    )
    and (old.user_id is null or old.user_id = new.user_id)
    and new.user_id is not null
    and new.onboarding_status in (
      'activated'::public.resident_onboarding_status_enum,
      'profile_incomplete'::public.resident_onboarding_status_enum,
      'documents_pending'::public.resident_onboarding_status_enum,
      'verification_pending'::public.resident_onboarding_status_enum,
      'verified'::public.resident_onboarding_status_enum
    ) then
      return new;
    end if;

    raise exception 'Invalid resident activation bootstrap update';
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

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.users (
    id,
    full_name,
    email,
    phone,
    default_role,
    is_active,
    metadata
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      nullif(new.phone, ''),
      'New User'
    ),
    new.email,
    new.phone,
    'resident',
    true,
    jsonb_build_object(
      'source', 'auth_trigger',
      'synced_at', now()
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    phone = excluded.phone,
    metadata = public.users.metadata || jsonb_build_object('last_auth_trigger_sync_at', now()),
    updated_at = now();

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Auth insert trigger only synchronizes public.users. Resident invite activation is handled by activate_resident_invite_atomic to avoid pre-ownership RLS mismatches.';

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

  if v_invite.status <> 'pending'
     or v_invite.used_at is not null
     or v_invite.revoked_at is not null then
    raise exception 'invite_already_used' using errcode = '23505';
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
    or (
      v_invite.phone is not null
      and v_auth_user.phone is not null
      and regexp_replace(v_auth_user.phone, '\D', '', 'g') = regexp_replace(v_invite.phone, '\D', '', 'g')
    )
  ) then
    raise exception 'invite_identity_mismatch' using errcode = '42501';
  end if;

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
      'activated_at', v_now
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
    metadata = public.users.metadata || jsonb_build_object(
      'resident_id', v_resident.id,
      'last_resident_activation_at', v_now
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
    onboarding_metadata = onboarding_metadata || jsonb_build_object(
      'activation', jsonb_build_object(
        'invite_id', v_invite.id,
        'activated_at', v_now,
        'auth_user_id', p_auth_user_id
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
    updated_by = p_auth_user_id
  where id = v_invite.id
    and status = 'pending'
    and used_at is null
    and revoked_at is null;

  update public.resident_invites
  set
    status = 'revoked',
    revoked_at = v_now,
    updated_at = v_now,
    updated_by = p_auth_user_id
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
      'auth_user_id', p_auth_user_id
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
  'Service-role-only activation bootstrap. Atomically validates invite ownership, links resident.user_id, grants resident role, marks invite used, and writes an audit log.';

revoke execute on function public.activate_resident_invite_atomic(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_resident_invite_atomic(uuid, text, uuid)
  to service_role;

commit;
