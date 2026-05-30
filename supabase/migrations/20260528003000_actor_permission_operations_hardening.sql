-- Final actor validation and permission matrix hardening.
-- Ensures SECURITY DEFINER code trusts auth.uid()/service JWT context instead
-- of caller-supplied actor columns, and aligns database helpers with the
-- application role capability matrix.

begin;

create or replace function public.is_service_context()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(current_setting('request.jwt.claim.role', true), '') in (
      'service_role',
      'supabase_admin'
    )
    or (
      auth.uid() is null
      and coalesce(current_setting('request.jwt.claim.sub', true), '') = ''
      and current_user in ('postgres', 'supabase_admin', 'service_role')
    );
$$;

comment on function public.is_service_context() is
  'True only for service-role JWTs or migration/admin SQL sessions without an end-user JWT. SECURITY DEFINER ownership alone is not treated as service context.';

create or replace function public.assert_trusted_actor(
  p_actor_user_id uuid default auth.uid(),
  p_context text default 'rpc',
  p_allow_service_role boolean default true
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
begin
  if public.is_service_context() then
    if not p_allow_service_role then
      raise exception 'service_role_actor_not_allowed:%', p_context
        using errcode = '42501';
    end if;

    return p_actor_user_id;
  end if;

  if v_auth_user_id is null then
    raise exception 'auth_required:%', p_context using errcode = '28000';
  end if;

  if p_actor_user_id is not null and p_actor_user_id <> v_auth_user_id then
    raise exception 'actor_spoofing_detected:%', p_context using errcode = '42501';
  end if;

  return v_auth_user_id;
end;
$$;

comment on function public.assert_trusted_actor(uuid, text, boolean) is
  'Reusable RPC guard. Authenticated callers may only attribute mutations to auth.uid(); service-role bypass is explicit via p_allow_service_role.';

create or replace function public.role_has_permission(
  p_role public.user_role_enum,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_role
    when 'super_admin' then p_permission = any(array[
      'admin.dashboard.view',
      'admissions.manage',
      'analytics.view',
      'cms.manage',
      'finance.manage',
      'iam.manage',
      'leaves.manage',
      'notices.manage',
      'payments.verify',
      'reports.export',
      'residents.manage',
      'rooms.manage',
      'settings.manage'
    ])
    when 'owner' then p_permission = any(array[
      'admin.dashboard.view',
      'admissions.manage',
      'analytics.view',
      'cms.manage',
      'finance.manage',
      'iam.manage',
      'leaves.manage',
      'notices.manage',
      'payments.verify',
      'reports.export',
      'residents.manage',
      'rooms.manage',
      'settings.manage'
    ])
    when 'admin' then p_permission = any(array[
      'admin.dashboard.view',
      'admissions.manage',
      'analytics.view',
      'cms.manage',
      'finance.manage',
      'iam.manage',
      'leaves.manage',
      'notices.manage',
      'payments.verify',
      'reports.export',
      'residents.manage',
      'rooms.manage',
      'settings.manage'
    ])
    when 'finance' then p_permission = any(array[
      'admin.dashboard.view',
      'analytics.view',
      'finance.manage',
      'payments.verify',
      'reports.export'
    ])
    when 'receptionist' then p_permission = any(array[
      'admin.dashboard.view',
      'admissions.manage',
      'notices.manage',
      'residents.manage'
    ])
    when 'warden' then p_permission = any(array[
      'admin.dashboard.view',
      'leaves.manage',
      'notices.manage',
      'residents.manage',
      'rooms.manage'
    ])
    when 'staff' then p_permission = any(array[
      'admin.dashboard.view',
      'notices.manage',
      'residents.manage'
    ])
    else false
  end;
$$;

comment on function public.role_has_permission(public.user_role_enum, text) is
  'Database copy of src/constants/auth.ts ROLE_PERMISSIONS for RLS and RPC guards.';

create or replace function public.has_permission_in_organization(
  p_organization_id uuid,
  p_permission text,
  p_hostel_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p_organization_id is not null
    and (
      public.is_service_context()
      or public.is_super_admin()
      or exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.organization_id = p_organization_id
          and u.default_role in ('super_admin', 'owner', 'admin')
          and u.is_active is true
          and u.deleted_at is null
          and public.role_has_permission(u.default_role, p_permission)
      )
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.organization_id = p_organization_id
          and ur.status = 'active'
          and ur.deleted_at is null
          and public.role_has_permission(ur.role, p_permission)
          and (
            p_hostel_id is null
            or ur.hostel_id is null
            or ur.hostel_id = p_hostel_id
          )
      )
    );
$$;

comment on function public.has_permission_in_organization(uuid, text, uuid) is
  'Permission-based tenant guard used by RLS helper compatibility functions and new RPCs.';

create or replace function public.get_current_user_role()
returns public.user_role_enum
language sql
stable
security definer
set search_path = public, auth
as $$
  with active_roles as (
    select ur.role
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.status = 'active'
      and ur.deleted_at is null
    union all
    select u.default_role
    from public.users u
    where u.id = auth.uid()
      and u.is_active = true
      and u.deleted_at is null
  )
  select role
  from active_roles
  order by case role
    when 'super_admin' then 1
    when 'owner' then 2
    when 'admin' then 3
    when 'finance' then 4
    when 'warden' then 5
    when 'staff' then 6
    when 'receptionist' then 7
    when 'resident' then 8
    when 'parent' then 9
    else 99
  end
  limit 1;
$$;

create or replace function public.get_current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select ur.organization_id
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.status = 'active'
        and ur.deleted_at is null
      order by case ur.role
        when 'owner' then 1
        when 'admin' then 2
        when 'finance' then 3
        when 'warden' then 4
        when 'receptionist' then 5
        when 'staff' then 6
        when 'resident' then 7
        when 'parent' then 8
        else 99
      end, ur.created_at
      limit 1
    ),
    (
      select u.organization_id
      from public.users u
      where u.id = auth.uid()
        and u.is_active = true
        and u.deleted_at is null
    )
  );
$$;

create or replace function public.can_manage_organization(
  org_id uuid,
  hostel_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission_in_organization(
    org_id,
    'residents.manage',
    hostel_id
  );
$$;

comment on function public.can_manage_organization(uuid, uuid) is
  'Compatibility helper for tenant operations. Backed by the canonical residents.manage capability instead of legacy owner/admin/staff buckets.';

create or replace function public.can_manage_finance(
  org_id uuid,
  hostel_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission_in_organization(
    org_id,
    'finance.manage',
    hostel_id
  );
$$;

comment on function public.can_manage_finance(uuid, uuid) is
  'Finance tenant guard backed by the canonical finance.manage capability.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission_in_organization(
    public.get_current_organization_id(),
    'admin.dashboard.view'
  );
$$;

comment on function public.is_admin() is
  'Compatibility helper for admin-portal membership. Capability-specific helpers should be preferred for new policies.';

create or replace function public.enforce_actor_column_trust()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_column text;
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_new_value text;
  v_old_value text;
  v_actor_columns text[] := array[
    'actor_user_id',
    'audit_user_id',
    'created_by',
    'updated_by',
    'deleted_by',
    'verified_by',
    'reviewed_by',
    'cancelled_by',
    'received_by',
    'created_by_user_id',
    'onboarding_verified_by',
    'published_by',
    'uploaded_by_user_id'
  ];
begin
  if public.is_service_context() then
    return new;
  end if;

  foreach v_column in array v_actor_columns loop
    if not (v_new ? v_column) then
      continue;
    end if;

    v_new_value := nullif(v_new ->> v_column, '');

    if tg_op = 'INSERT' then
      if v_new_value is not null then
        if v_actor_id is null then
          raise exception 'auth_required:%', tg_table_name || '.' || v_column
            using errcode = '28000';
        end if;

        if v_new_value <> v_actor_id::text then
          raise exception 'actor_column_spoofing_detected:%', tg_table_name || '.' || v_column
            using errcode = '42501';
        end if;
      end if;
    elsif tg_op = 'UPDATE' then
      v_old_value := case
        when v_old ? v_column then nullif(v_old ->> v_column, '')
        else null
      end;

      if v_new_value is distinct from v_old_value and v_new_value is not null then
        if v_actor_id is null then
          raise exception 'auth_required:%', tg_table_name || '.' || v_column
            using errcode = '28000';
        end if;

        if v_new_value <> v_actor_id::text then
          raise exception 'actor_column_spoofing_detected:%', tg_table_name || '.' || v_column
            using errcode = '42501';
        end if;
      end if;
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.enforce_actor_column_trust() is
  'Trigger guard for audit attribution columns. Authenticated writes cannot forge actor identity; service-role operational jobs remain explicit exceptions.';

do $$
declare
  v_table record;
begin
  for v_table in
    select distinct c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.column_name = any(array[
        'actor_user_id',
        'audit_user_id',
        'created_by',
        'updated_by',
        'deleted_by',
        'verified_by',
        'reviewed_by',
        'cancelled_by',
        'received_by',
        'created_by_user_id',
        'onboarding_verified_by',
        'published_by',
        'uploaded_by_user_id'
      ])
  loop
    execute format(
      'drop trigger if exists enforce_actor_column_trust on public.%I',
      v_table.table_name
    );
    execute format(
      'create trigger enforce_actor_column_trust before insert or update on public.%I for each row execute function public.enforce_actor_column_trust()',
      v_table.table_name
    );
  end loop;
end;
$$;

revoke all on function public.assert_trusted_actor(uuid, text, boolean)
  from public, anon;
grant execute on function public.assert_trusted_actor(uuid, text, boolean)
  to authenticated, service_role;

revoke all on function public.role_has_permission(public.user_role_enum, text)
  from public, anon;
grant execute on function public.role_has_permission(public.user_role_enum, text)
  to authenticated, service_role;

revoke all on function public.has_permission_in_organization(uuid, text, uuid)
  from public, anon;
grant execute on function public.has_permission_in_organization(uuid, text, uuid)
  to authenticated, service_role;

revoke all on function public.enforce_actor_column_trust()
  from public, anon, authenticated;

commit;
