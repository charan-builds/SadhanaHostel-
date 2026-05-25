-- Phone-first resident access hardening.
-- Supabase Auth stores phone numbers in E.164 form, while hostel operators may
-- enter Indian 10-digit numbers during quick admission. Activation identity
-- checks must treat those as the same phone without weakening invite ownership.

begin;

create or replace function public.phone_numbers_match(
  p_left text,
  p_right text
)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select
      regexp_replace(coalesce(p_left, ''), '\D', '', 'g') as left_digits,
      regexp_replace(coalesce(p_right, ''), '\D', '', 'g') as right_digits
  )
  select
    left_digits <> ''
    and right_digits <> ''
    and (
      left_digits = right_digits
      or (
        length(left_digits) >= 10
        and length(right_digits) >= 10
        and right(left_digits, 10) = right(right_digits, 10)
      )
    )
  from normalized;
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
    or public.phone_numbers_match(v_auth_user.phone, v_invite.phone)
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
        'auth_user_id', p_auth_user_id,
        'phone_first_access', true
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
      'auth_user_id', p_auth_user_id,
      'phone_first_access', true
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

comment on function public.phone_numbers_match(text, text) is
  'Compares phone numbers safely for invite activation, accepting E.164 and local 10-digit Indian forms.';

comment on function public.activate_resident_invite_atomic(uuid, text, uuid) is
  'Service-role-only activation bootstrap. Atomically validates invite ownership, links resident.user_id, grants resident role, marks invite used, and writes an audit log. Phone comparison supports E.164 and local Indian formats.';

revoke execute on function public.activate_resident_invite_atomic(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_resident_invite_atomic(uuid, text, uuid)
  to service_role;

commit;
