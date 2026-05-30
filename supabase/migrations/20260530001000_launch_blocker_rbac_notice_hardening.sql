-- Launch blocker hardening:
-- 1. Active role assignments are authoritative when present; users.default_role
--    remains only as a legacy no-assignment fallback.
-- 2. Role-targeted notices must be scoped to the reader's tenant/hostel.

begin;

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
  with active_assignments as (
    select ur.role, ur.hostel_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.organization_id = p_organization_id
      and ur.status = 'active'
      and ur.deleted_at is null
  )
  select
    p_organization_id is not null
    and (
      public.is_service_context()
      or public.is_super_admin()
      or exists (
        select 1
        from active_assignments ur
        where public.role_has_permission(ur.role, p_permission)
          and (
            p_hostel_id is null
            or ur.hostel_id is null
            or ur.hostel_id = p_hostel_id
          )
      )
      or (
        not exists (select 1 from active_assignments)
        and exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.organization_id = p_organization_id
            and u.default_role in ('super_admin', 'owner', 'admin')
            and u.is_active is true
            and u.deleted_at is null
            and public.role_has_permission(u.default_role, p_permission)
        )
      )
    );
$$;

comment on function public.has_permission_in_organization(uuid, text, uuid) is
  'Permission guard. Active user_roles are authoritative; users.default_role is only a legacy fallback when no active assignment exists for that organization.';

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
  ),
  fallback_role as (
    select u.default_role as role
    from public.users u
    where u.id = auth.uid()
      and u.is_active = true
      and u.deleted_at is null
      and not exists (select 1 from active_roles)
  ),
  effective_roles as (
    select role from active_roles
    union all
    select role from fallback_role
  )
  select role
  from effective_roles
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

create or replace function public.can_read_notice(target_notice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.notices n
    where n.id = target_notice_id
      and n.deleted_at is null
      and (
        public.can_manage_organization(n.organization_id, n.hostel_id)
        or (
          n.status = 'published'
          and (n.expires_at is null or n.expires_at > now())
          and (
            n.audience_type = 'all'
            or (
              n.audience_type = 'hostel'
              and exists (
                select 1
                from public.residents r
                where (r.user_id = auth.uid() or r.parent_user_id = auth.uid())
                  and r.organization_id = n.organization_id
                  and (n.hostel_id is null or r.hostel_id = n.hostel_id)
                  and r.deleted_at is null
              )
            )
            or (
              n.audience_type = 'residents'
              and exists (
                select 1
                from public.residents r
                where (r.user_id = auth.uid() or r.parent_user_id = auth.uid())
                  and r.organization_id = n.organization_id
                  and r.deleted_at is null
                  and r.id::text in (
                    select jsonb_array_elements_text(coalesce(n.audience_filter -> 'resident_ids', '[]'::jsonb))
                  )
              )
            )
            or (
              n.audience_type = 'room'
              and exists (
                select 1
                from public.residents r
                join public.room_allocations ra on ra.resident_id = r.id
                where (r.user_id = auth.uid() or r.parent_user_id = auth.uid())
                  and r.organization_id = n.organization_id
                  and ra.status = 'active'
                  and ra.deleted_at is null
                  and ra.room_id::text in (
                    select jsonb_array_elements_text(coalesce(n.audience_filter -> 'room_ids', '[]'::jsonb))
                  )
              )
            )
            or (
              n.audience_type = 'roles'
              and public.belongs_to_organization(n.organization_id)
              and exists (
                select 1
                from (
                  select ur.role
                  from public.user_roles ur
                  where ur.user_id = auth.uid()
                    and ur.organization_id = n.organization_id
                    and ur.status = 'active'
                    and ur.deleted_at is null
                    and (
                      n.hostel_id is null
                      or ur.hostel_id is null
                      or ur.hostel_id = n.hostel_id
                    )
                  union all
                  select u.default_role as role
                  from public.users u
                  where u.id = auth.uid()
                    and u.organization_id = n.organization_id
                    and u.is_active is true
                    and u.deleted_at is null
                    and not exists (
                      select 1
                      from public.user_roles ur
                      where ur.user_id = auth.uid()
                        and ur.organization_id = n.organization_id
                        and ur.status = 'active'
                        and ur.deleted_at is null
                    )
                ) effective_notice_roles
                where effective_notice_roles.role::text in (
                  select jsonb_array_elements_text(coalesce(n.audience_filter -> 'roles', '[]'::jsonb))
                )
              )
            )
          )
        )
      )
  );
$$;

comment on function public.can_read_notice(uuid) is
  'Notice audience guard. Role-targeted notices require both matching role and tenant/hostel membership.';

commit;
