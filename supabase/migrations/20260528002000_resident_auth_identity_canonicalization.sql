-- Canonical resident auth identity and login repair.
-- Keeps the password-login alias synchronized across auth.users, public.users,
-- residents, and resident_invites so phone-first residents can repeatedly log
-- in after activation, cleanup, and retry flows.

begin;

create or replace function public.resident_internal_auth_email(p_resident_id uuid)
returns text
language sql
immutable
as $$
  select 'resident-' || replace(p_resident_id::text, '-', '') || '@auth.sadhanahostel.invalid'
$$;

comment on function public.resident_internal_auth_email(uuid) is
  'Deterministic internal email alias used as the canonical Supabase password credential for phone-only resident identities.';

create or replace function public.sync_resident_auth_alias_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user auth.users%rowtype;
  v_metadata jsonb := coalesce(new.metadata, '{}'::jsonb);
  v_resident_id_text text;
  v_resident_id uuid;
  v_auth_login_email text;
  v_internal_auth_email text;
  v_resident_identity_mode text;
begin
  if not (
    new.default_role = 'resident'::public.user_role_enum
    or v_metadata ? 'resident_id'
  ) then
    return new;
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = new.id;

  v_resident_id_text := coalesce(
    v_metadata ->> 'resident_id',
    v_auth_user.raw_user_meta_data ->> 'resident_id'
  );

  if v_resident_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_resident_id := v_resident_id_text::uuid;
  end if;

  v_internal_auth_email := lower(nullif(trim(coalesce(
    v_metadata ->> 'internal_auth_email',
    v_auth_user.raw_user_meta_data ->> 'internal_auth_email',
    case
      when lower(coalesce(v_auth_user.email::text, '')) like '%@auth.sadhanahostel.invalid'
        then v_auth_user.email::text
      else null
    end,
    case
      when lower(coalesce(new.email::text, '')) like '%@auth.sadhanahostel.invalid'
        then new.email::text
      else null
    end,
    case
      when v_resident_id is not null
        then public.resident_internal_auth_email(v_resident_id)
      else null
    end
  )), ''));

  v_auth_login_email := lower(nullif(trim(coalesce(
    v_metadata ->> 'auth_login_email',
    v_auth_user.raw_user_meta_data ->> 'auth_login_email',
    v_internal_auth_email,
    v_auth_user.email::text,
    new.email::text
  )), ''));

  v_resident_identity_mode := coalesce(
    v_metadata ->> 'resident_identity_mode',
    v_auth_user.raw_user_meta_data ->> 'resident_identity_mode'
  );

  if v_resident_id is not null or v_auth_login_email is not null or v_internal_auth_email is not null then
    new.metadata := v_metadata || jsonb_strip_nulls(jsonb_build_object(
      'resident_id', coalesce(v_resident_id::text, v_resident_id_text),
      'hostel_id', coalesce(v_metadata ->> 'hostel_id', v_auth_user.raw_user_meta_data ->> 'hostel_id'),
      'auth_login_email', v_auth_login_email,
      'internal_auth_email', v_internal_auth_email,
      'resident_identity_mode', v_resident_identity_mode,
      'phone_password_login_strategy', case
        when v_internal_auth_email is not null then 'internal_email_alias'
        else coalesce(
          v_metadata ->> 'phone_password_login_strategy',
          v_auth_user.raw_user_meta_data ->> 'phone_password_login_strategy',
          'direct_email'
        )
      end,
      'resident_auth_identity_version', 2,
      'resident_auth_alias_synced_at', now()
    ));
  end if;

  return new;
end;
$$;

drop trigger if exists sync_resident_auth_alias_metadata on public.users;
create trigger sync_resident_auth_alias_metadata
before insert or update on public.users
for each row
execute function public.sync_resident_auth_alias_metadata();

update public.users
set metadata = metadata
where deleted_at is null
  and (
    default_role = 'resident'::public.user_role_enum
    or metadata ? 'resident_id'
  );

create unique index if not exists users_resident_auth_login_email_uidx
  on public.users (lower(metadata ->> 'auth_login_email'))
  where deleted_at is null
    and metadata ->> 'auth_login_email' is not null;

create unique index if not exists users_resident_internal_auth_email_uidx
  on public.users (lower(metadata ->> 'internal_auth_email'))
  where deleted_at is null
    and metadata ->> 'internal_auth_email' is not null;

create unique index if not exists users_resident_phone_uidx
  on public.users (organization_id, phone)
  where deleted_at is null
    and default_role = 'resident'::public.user_role_enum
    and phone is not null;

create or replace function public.repair_resident_auth_identity_atomic(
  p_organization_id uuid,
  p_resident_id uuid,
  p_auth_user_id uuid,
  p_auth_login_email text,
  p_internal_auth_email text default null,
  p_reason text default 'login_repair'
)
returns public.residents
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := now();
  v_resident public.residents%rowtype;
  v_auth_user auth.users%rowtype;
  v_existing_resident public.residents%rowtype;
  v_previous_onboarding_status public.resident_onboarding_status_enum;
  v_auth_org_id text;
  v_auth_resident_id text;
  v_login_email text;
  v_internal_email text;
  v_display_name text;
  v_identity_mode text;
begin
  if not public.is_service_context() then
    raise exception 'resident_auth_identity_repair_service_role_required' using errcode = '42501';
  end if;

  if p_organization_id is null or p_resident_id is null or p_auth_user_id is null then
    raise exception 'resident_auth_identity_repair_arguments_required' using errcode = '22023';
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

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_resident.organization_id::text || ':resident-auth-identity:' || v_resident.id::text,
      0
    )
  );

  select *
  into v_auth_user
  from auth.users
  where id = p_auth_user_id;

  if not found then
    raise exception 'auth_user_not_found' using errcode = 'P0002';
  end if;

  v_auth_org_id := v_auth_user.raw_user_meta_data ->> 'organization_id';
  v_auth_resident_id := v_auth_user.raw_user_meta_data ->> 'resident_id';

  if v_auth_org_id is not null and v_auth_org_id <> v_resident.organization_id::text then
    raise exception 'auth_identity_tenant_mismatch' using errcode = '42501';
  end if;

  if v_auth_resident_id is not null
     and v_auth_resident_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and v_auth_resident_id::uuid <> v_resident.id then
    select *
    into v_existing_resident
    from public.residents
    where id = v_auth_resident_id::uuid
      and organization_id = v_resident.organization_id
      and deleted_at is null
    limit 1;

    if found then
      raise exception 'auth_user_linked_to_other_resident' using errcode = '23505';
    end if;
  end if;

  select *
  into v_existing_resident
  from public.residents
  where user_id = p_auth_user_id
    and id <> v_resident.id
    and organization_id = v_resident.organization_id
    and deleted_at is null
  limit 1;

  if found then
    raise exception 'auth_user_linked_to_other_resident' using errcode = '23505';
  end if;

  v_internal_email := lower(nullif(trim(coalesce(
    p_internal_auth_email,
    v_auth_user.raw_user_meta_data ->> 'internal_auth_email',
    case
      when lower(coalesce(v_auth_user.email::text, '')) like '%@auth.sadhanahostel.invalid'
        then v_auth_user.email::text
      else null
    end,
    case
      when v_resident.email is null then public.resident_internal_auth_email(v_resident.id)
      else null
    end
  )), ''));

  v_login_email := lower(nullif(trim(coalesce(
    p_auth_login_email,
    v_auth_user.raw_user_meta_data ->> 'auth_login_email',
    v_internal_email,
    v_auth_user.email::text,
    v_resident.email::text
  )), ''));

  if v_login_email is null or position('@' in v_login_email) = 0 then
    raise exception 'resident_auth_login_email_missing' using errcode = '22023';
  end if;

  if not (
    v_resident.user_id = p_auth_user_id
    or v_auth_resident_id = v_resident.id::text
    or lower(coalesce(v_auth_user.email::text, '')) = v_login_email
    or (
      v_resident.email is not null
      and v_auth_user.email is not null
      and lower(v_auth_user.email::text) = lower(v_resident.email::text)
    )
    or lower(coalesce(v_auth_user.email::text, '')) = coalesce(v_internal_email, '')
    or public.phone_numbers_match(v_auth_user.phone, v_resident.phone)
  ) then
    raise exception 'resident_auth_identity_mismatch' using errcode = '42501';
  end if;

  v_previous_onboarding_status := v_resident.onboarding_status;
  v_identity_mode := case
    when v_resident.email is not null and v_resident.phone is not null then 'email_and_phone'
    when v_resident.email is not null then 'email'
    else 'phone'
  end;
  v_display_name := nullif(trim(coalesce(
    v_auth_user.raw_user_meta_data ->> 'full_name',
    v_auth_user.raw_user_meta_data ->> 'name',
    v_resident.full_name,
    split_part(coalesce(v_auth_user.email::text, ''), '@', 1),
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
    v_resident.email,
    coalesce(public.normalize_indian_phone(v_auth_user.phone), v_resident.phone),
    v_resident.organization_id,
    'resident',
    true,
    coalesce(v_auth_user.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'source', 'resident_auth_identity_repair',
      'resident_id', v_resident.id,
      'hostel_id', v_resident.hostel_id,
      'auth_login_email', v_login_email,
      'internal_auth_email', v_internal_email,
      'resident_identity_mode', v_identity_mode,
      'phone_password_login_strategy', case
        when v_internal_email is not null then 'internal_email_alias'
        else 'direct_email'
      end,
      'resident_auth_identity_version', 2,
      'last_auth_linkage_resync_at', v_now,
      'repair_reason', p_reason
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
    metadata = coalesce(public.users.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'resident_id', v_resident.id,
        'hostel_id', v_resident.hostel_id,
        'auth_login_email', v_login_email,
        'internal_auth_email', v_internal_email,
        'resident_identity_mode', v_identity_mode,
        'phone_password_login_strategy', case
          when v_internal_email is not null then 'internal_email_alias'
          else 'direct_email'
        end,
        'resident_auth_identity_version', 2,
        'last_auth_linkage_resync_at', v_now,
        'repair_reason', p_reason
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
    onboarding_metadata = coalesce(onboarding_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'resident_auth_identity_repaired_at', v_now,
        'repair_reason', p_reason,
        'previous_user_id', v_resident.user_id,
        'previous_onboarding_status', v_previous_onboarding_status,
        'auth_login_email', v_login_email
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
    'resident.auth_identity_repair',
    null,
    to_jsonb(v_resident),
    jsonb_build_object(
      'auth_user_id', p_auth_user_id,
      'auth_login_email', v_login_email,
      'internal_auth_email', v_internal_email,
      'previous_onboarding_status', v_previous_onboarding_status,
      'next_onboarding_status', v_resident.onboarding_status,
      'reason', p_reason
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

comment on function public.repair_resident_auth_identity_atomic(uuid, uuid, uuid, text, text, text) is
  'Service-role-only atomic repair for resident auth desynchronization. Relinks one resident to one auth identity, syncs the public profile alias, restores resident role assignment, and writes an audit log.';

revoke execute on function public.sync_resident_auth_alias_metadata()
  from public, anon, authenticated;
revoke execute on function public.repair_resident_auth_identity_atomic(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.repair_resident_auth_identity_atomic(uuid, uuid, uuid, text, text, text)
  to service_role;

commit;
