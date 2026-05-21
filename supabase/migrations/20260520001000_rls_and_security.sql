-- Sadhana Boys Hostel Platform
-- Production RLS, tenant isolation, RBAC, storage, and financial protection.

begin;

-- ---------------------------------------------------------------------------
-- Core auth and tenant helper functions
-- ---------------------------------------------------------------------------

create or replace function public.get_current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid();
$$;

create or replace function public.is_service_context()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    current_user in ('postgres', 'supabase_admin', 'service_role')
    or coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'supabase_admin');
$$;

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
    when 'staff' then 4
    when 'resident' then 5
    when 'parent' then 6
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
        when 'staff' then 3
        when 'resident' then 4
        when 'parent' then 5
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

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin'
      and ur.status = 'active'
      and ur.deleted_at is null
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.is_platform_user = true
      and u.is_active = true
      and u.deleted_at is null
  );
$$;

create or replace function public.has_role_in_organization(
  target_organization_id uuid,
  allowed_roles public.user_role_enum[],
  target_hostel_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.organization_id = target_organization_id
      and ur.role = any(allowed_roles)
      and ur.status = 'active'
      and ur.deleted_at is null
      and (
        target_hostel_id is null
        or ur.hostel_id is null
        or ur.hostel_id = target_hostel_id
      )
  );
$$;

create or replace function public.belongs_to_organization(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select org_id is not null and (
    public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = org_id
        and ur.status = 'active'
        and ur.deleted_at is null
    )
    or exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.organization_id = org_id
        and u.is_active = true
        and u.deleted_at is null
    )
  );
$$;

create or replace function public.can_manage_organization(org_id uuid, hostel_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.has_role_in_organization(
      org_id,
      array['owner', 'admin', 'staff']::public.user_role_enum[],
      hostel_id
    );
$$;

create or replace function public.can_manage_finance(org_id uuid, hostel_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.has_role_in_organization(
      org_id,
      array['owner', 'admin']::public.user_role_enum[],
      hostel_id
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = public.get_current_user_id()
        and ur.role in ('owner', 'admin', 'staff')
        and ur.status = 'active'
        and ur.deleted_at is null
    );
$$;

create or replace function public.is_resident()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.residents r
    where r.user_id = auth.uid()
      and r.deleted_at is null
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'resident'
      and ur.status = 'active'
      and ur.deleted_at is null
  );
$$;

create or replace function public.owns_resident(target_resident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_resident_id is not null and exists (
    select 1
    from public.residents r
    where r.id = target_resident_id
      and r.deleted_at is null
      and (
        r.user_id = auth.uid()
        or r.parent_user_id = auth.uid()
      )
  );
$$;

create or replace function public.can_access_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_user_id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1
      from public.user_roles target_role
      join public.user_roles current_user_role
        on current_user_role.organization_id = target_role.organization_id
      where target_role.user_id = target_user_id
        and current_user_role.user_id = auth.uid()
        and current_user_role.role in ('owner', 'admin', 'staff')
        and current_user_role.status = 'active'
        and target_role.status = 'active'
        and current_user_role.deleted_at is null
        and target_role.deleted_at is null
        and (
          current_user_role.hostel_id is null
          or target_role.hostel_id is null
          or current_user_role.hostel_id = target_role.hostel_id
        )
    );
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
              and public.get_current_user_role()::text in (
                select jsonb_array_elements_text(coalesce(n.audience_filter -> 'roles', '[]'::jsonb))
              )
            )
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Safe UUID and storage path helpers.
-- Storage object names must begin with organization_id and, where applicable,
-- resident_id:
--   {organization_id}/{resident_id}/file.ext
--   {organization_id}/gallery/file.ext
--   {organization_id}/invoices/{resident_id}/file.pdf
-- ---------------------------------------------------------------------------

create or replace function public.safe_uuid(input text)
returns uuid
language plpgsql
immutable
as $$
begin
  return input::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.storage_object_organization_id(object_name text)
returns uuid
language sql
immutable
as $$
  select public.safe_uuid(split_part(object_name, '/', 1));
$$;

create or replace function public.storage_object_resident_id(object_name text)
returns uuid
language sql
immutable
as $$
  select public.safe_uuid(split_part(object_name, '/', 2));
$$;

-- ---------------------------------------------------------------------------
-- Database-level protection triggers
-- ---------------------------------------------------------------------------

create or replace function public.protect_resident_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
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

create or replace function public.protect_financial_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_context() then
    return new;
  end if;

  if not public.can_manage_finance(old.organization_id, old.hostel_id) then
    raise exception 'Only finance admins can update financial records';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_protected_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_context() then
    return old;
  end if;

  raise exception 'Hard deletes are disabled for protected records. Use status or soft delete fields.';
end;
$$;

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_context() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Audit logs are append-only';
end;
$$;

drop trigger if exists protect_resident_profile_update on public.residents;
create trigger protect_resident_profile_update
before update on public.residents
for each row
execute function public.protect_resident_profile_update();

drop trigger if exists protect_monthly_fee_records_update on public.monthly_fee_records;
create trigger protect_monthly_fee_records_update
before update on public.monthly_fee_records
for each row
execute function public.protect_financial_update();

drop trigger if exists protect_invoices_update on public.invoices;
create trigger protect_invoices_update
before update on public.invoices
for each row
execute function public.protect_financial_update();

drop trigger if exists protect_payments_update on public.payments;
create trigger protect_payments_update
before update on public.payments
for each row
execute function public.protect_financial_update();

drop trigger if exists prevent_monthly_fee_records_delete on public.monthly_fee_records;
create trigger prevent_monthly_fee_records_delete
before delete on public.monthly_fee_records
for each row
execute function public.prevent_protected_delete();

drop trigger if exists prevent_invoices_delete on public.invoices;
create trigger prevent_invoices_delete
before delete on public.invoices
for each row
execute function public.prevent_protected_delete();

drop trigger if exists prevent_payments_delete on public.payments;
create trigger prevent_payments_delete
before delete on public.payments
for each row
execute function public.prevent_protected_delete();

drop trigger if exists prevent_payment_webhooks_delete on public.payment_webhooks;
create trigger prevent_payment_webhooks_delete
before delete on public.payment_webhooks
for each row
execute function public.prevent_protected_delete();

drop trigger if exists prevent_notification_logs_delete on public.notification_logs;
create trigger prevent_notification_logs_delete
before delete on public.notification_logs
for each row
execute function public.prevent_protected_delete();

drop trigger if exists prevent_audit_logs_update on public.audit_logs;
create trigger prevent_audit_logs_update
before update on public.audit_logs
for each row
execute function public.prevent_audit_log_mutation();

drop trigger if exists prevent_audit_logs_delete on public.audit_logs;
create trigger prevent_audit_logs_delete
before delete on public.audit_logs
for each row
execute function public.prevent_audit_log_mutation();

-- ---------------------------------------------------------------------------
-- Force RLS on all application tables.
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.hostels enable row level security;
alter table public.hostels force row level security;
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;
alter table public.residents enable row level security;
alter table public.residents force row level security;
alter table public.rooms enable row level security;
alter table public.rooms force row level security;
alter table public.room_allocations enable row level security;
alter table public.room_allocations force row level security;
alter table public.monthly_fee_records enable row level security;
alter table public.monthly_fee_records force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;
alter table public.invoices enable row level security;
alter table public.invoices force row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_requests force row level security;
alter table public.notices enable row level security;
alter table public.notices force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.gallery enable row level security;
alter table public.gallery force row level security;
alter table public.website_settings enable row level security;
alter table public.website_settings force row level security;
alter table public.facilities enable row level security;
alter table public.facilities force row level security;
alter table public.documents enable row level security;
alter table public.documents force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.payment_webhooks enable row level security;
alter table public.payment_webhooks force row level security;
alter table public.notification_logs enable row level security;
alter table public.notification_logs force row level security;
alter table public.support_requests enable row level security;
alter table public.support_requests force row level security;

-- ---------------------------------------------------------------------------
-- RLS policies: tenant and role isolation.
-- No delete policies are created for business tables; use soft delete/status.
-- ---------------------------------------------------------------------------

-- organizations
drop policy if exists "organizations_select_by_membership" on public.organizations;
create policy "organizations_select_by_membership"
on public.organizations
for select
to authenticated
using (public.belongs_to_organization(id));

drop policy if exists "organizations_insert_super_admin" on public.organizations;
create policy "organizations_insert_super_admin"
on public.organizations
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "organizations_update_owner_admin" on public.organizations;
create policy "organizations_update_owner_admin"
on public.organizations
for update
to authenticated
using (
  public.is_super_admin()
  or public.has_role_in_organization(id, array['owner', 'admin']::public.user_role_enum[])
)
with check (
  public.is_super_admin()
  or public.has_role_in_organization(id, array['owner', 'admin']::public.user_role_enum[])
);

-- users
drop policy if exists "users_select_accessible" on public.users;
create policy "users_select_accessible"
on public.users
for select
to authenticated
using (public.can_access_user(id));

drop policy if exists "users_insert_self_or_admin" on public.users;
create policy "users_insert_self_or_admin"
on public.users
for insert
to authenticated
with check (
  id = public.get_current_user_id()
  or public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
);

drop policy if exists "users_update_admin_only" on public.users;
create policy "users_update_admin_only"
on public.users
for update
to authenticated
using (
  public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
)
with check (
  public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
);

-- hostels
drop policy if exists "hostels_select_by_membership" on public.hostels;
create policy "hostels_select_by_membership"
on public.hostels
for select
to authenticated
using (public.belongs_to_organization(organization_id));

drop policy if exists "hostels_write_admin" on public.hostels;
drop policy if exists "hostels_insert_admin" on public.hostels;
create policy "hostels_insert_admin"
on public.hostels
for insert
to authenticated
with check (public.can_manage_organization(organization_id, id));

drop policy if exists "hostels_update_admin" on public.hostels;
create policy "hostels_update_admin"
on public.hostels
for update
to authenticated
using (public.can_manage_organization(organization_id, id))
with check (public.can_manage_organization(organization_id, id));

-- user_roles
drop policy if exists "user_roles_select_accessible" on public.user_roles;
create policy "user_roles_select_accessible"
on public.user_roles
for select
to authenticated
using (
  user_id = public.get_current_user_id()
  or public.can_manage_organization(organization_id, hostel_id)
);

drop policy if exists "user_roles_write_owner_admin" on public.user_roles;
drop policy if exists "user_roles_insert_owner_admin" on public.user_roles;
create policy "user_roles_insert_owner_admin"
on public.user_roles
for insert
to authenticated
with check (
  public.is_super_admin()
  or public.has_role_in_organization(organization_id, array['owner', 'admin']::public.user_role_enum[], hostel_id)
);

drop policy if exists "user_roles_update_owner_admin" on public.user_roles;
create policy "user_roles_update_owner_admin"
on public.user_roles
for update
to authenticated
using (
  public.is_super_admin()
  or public.has_role_in_organization(organization_id, array['owner', 'admin']::public.user_role_enum[], hostel_id)
)
with check (
  public.is_super_admin()
  or public.has_role_in_organization(organization_id, array['owner', 'admin']::public.user_role_enum[], hostel_id)
);

-- residents
drop policy if exists "residents_select_admin_or_owner" on public.residents;
create policy "residents_select_admin_or_owner"
on public.residents
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(id)
);

drop policy if exists "residents_insert_admin" on public.residents;
create policy "residents_insert_admin"
on public.residents
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "residents_update_admin_or_self" on public.residents;
create policy "residents_update_admin_or_self"
on public.residents
for update
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(id)
)
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(id)
);

-- rooms
drop policy if exists "rooms_select_admin_or_allocated_resident" on public.rooms;
create policy "rooms_select_admin_or_allocated_resident"
on public.rooms
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or exists (
    select 1
    from public.room_allocations ra
    where ra.room_id = rooms.id
      and ra.status = 'active'
      and ra.deleted_at is null
      and public.owns_resident(ra.resident_id)
  )
);

drop policy if exists "rooms_write_admin" on public.rooms;
drop policy if exists "rooms_insert_admin" on public.rooms;
create policy "rooms_insert_admin"
on public.rooms
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "rooms_update_admin" on public.rooms;
create policy "rooms_update_admin"
on public.rooms
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- room_allocations
drop policy if exists "room_allocations_select_admin_or_resident" on public.room_allocations;
create policy "room_allocations_select_admin_or_resident"
on public.room_allocations
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "room_allocations_write_admin" on public.room_allocations;
drop policy if exists "room_allocations_insert_admin" on public.room_allocations;
create policy "room_allocations_insert_admin"
on public.room_allocations
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "room_allocations_update_admin" on public.room_allocations;
create policy "room_allocations_update_admin"
on public.room_allocations
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- monthly_fee_records
drop policy if exists "monthly_fee_records_select_admin_or_resident" on public.monthly_fee_records;
create policy "monthly_fee_records_select_admin_or_resident"
on public.monthly_fee_records
for select
to authenticated
using (
  public.can_manage_finance(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "monthly_fee_records_write_finance_admin" on public.monthly_fee_records;
drop policy if exists "monthly_fee_records_insert_finance_admin" on public.monthly_fee_records;
create policy "monthly_fee_records_insert_finance_admin"
on public.monthly_fee_records
for insert
to authenticated
with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists "monthly_fee_records_update_finance_admin" on public.monthly_fee_records;
create policy "monthly_fee_records_update_finance_admin"
on public.monthly_fee_records
for update
to authenticated
using (public.can_manage_finance(organization_id, hostel_id))
with check (public.can_manage_finance(organization_id, hostel_id));

-- invoices
drop policy if exists "invoices_select_admin_or_resident" on public.invoices;
create policy "invoices_select_admin_or_resident"
on public.invoices
for select
to authenticated
using (
  public.can_manage_finance(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "invoices_write_finance_admin" on public.invoices;
drop policy if exists "invoices_insert_finance_admin" on public.invoices;
create policy "invoices_insert_finance_admin"
on public.invoices
for insert
to authenticated
with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists "invoices_update_finance_admin" on public.invoices;
create policy "invoices_update_finance_admin"
on public.invoices
for update
to authenticated
using (public.can_manage_finance(organization_id, hostel_id))
with check (public.can_manage_finance(organization_id, hostel_id));

-- payments
drop policy if exists "payments_select_admin_or_resident" on public.payments;
create policy "payments_select_admin_or_resident"
on public.payments
for select
to authenticated
using (
  public.can_manage_finance(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "payments_write_finance_admin" on public.payments;
drop policy if exists "payments_insert_finance_admin" on public.payments;
create policy "payments_insert_finance_admin"
on public.payments
for insert
to authenticated
with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists "payments_update_finance_admin" on public.payments;
create policy "payments_update_finance_admin"
on public.payments
for update
to authenticated
using (public.can_manage_finance(organization_id, hostel_id))
with check (public.can_manage_finance(organization_id, hostel_id));

-- leave_requests
drop policy if exists "leave_requests_select_admin_or_resident" on public.leave_requests;
create policy "leave_requests_select_admin_or_resident"
on public.leave_requests
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "leave_requests_insert_resident_or_admin" on public.leave_requests;
create policy "leave_requests_insert_resident_or_admin"
on public.leave_requests
for insert
to authenticated
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or (
    public.owns_resident(resident_id)
    and status = 'pending'
  )
);

drop policy if exists "leave_requests_update_resident_pending_or_admin" on public.leave_requests;
create policy "leave_requests_update_resident_pending_or_admin"
on public.leave_requests
for update
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or (
    public.owns_resident(resident_id)
    and status = 'pending'
  )
)
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or (
    public.owns_resident(resident_id)
    and status in ('pending', 'cancelled')
  )
);

-- notices
drop policy if exists "notices_public_published_select" on public.notices;
create policy "notices_public_published_select"
on public.notices
for select
to anon
using (
  status = 'published'
  and audience_type = 'all'
  and deleted_at is null
  and (expires_at is null or expires_at > now())
);

drop policy if exists "notices_authenticated_select" on public.notices;
create policy "notices_authenticated_select"
on public.notices
for select
to authenticated
using (public.can_read_notice(id));

drop policy if exists "notices_write_admin" on public.notices;
drop policy if exists "notices_insert_admin" on public.notices;
create policy "notices_insert_admin"
on public.notices
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "notices_update_admin" on public.notices;
create policy "notices_update_admin"
on public.notices
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- notifications
drop policy if exists "notifications_select_recipient_or_admin" on public.notifications;
create policy "notifications_select_recipient_or_admin"
on public.notifications
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or recipient_user_id = public.get_current_user_id()
  or public.owns_resident(resident_id)
);

drop policy if exists "notifications_write_admin" on public.notifications;
drop policy if exists "notifications_insert_admin" on public.notifications;
create policy "notifications_insert_admin"
on public.notifications
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "notifications_update_admin" on public.notifications;
create policy "notifications_update_admin"
on public.notifications
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- documents
drop policy if exists "documents_select_owner_or_admin_or_public" on public.documents;
create policy "documents_select_owner_or_admin_or_public"
on public.documents
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
  or is_public = true
);

drop policy if exists "documents_insert_owner_or_admin" on public.documents;
create policy "documents_insert_owner_or_admin"
on public.documents
for insert
to authenticated
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or (
    public.owns_resident(resident_id)
    and document_type in ('aadhaar', 'profile_image', 'guardian_id', 'payment_receipt', 'support_attachment')
    and is_public = false
  )
);

drop policy if exists "documents_update_admin_only" on public.documents;
create policy "documents_update_admin_only"
on public.documents
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- gallery
drop policy if exists "gallery_public_published_select" on public.gallery;
create policy "gallery_public_published_select"
on public.gallery
for select
to anon
using (status = 'published' and deleted_at is null);

drop policy if exists "gallery_authenticated_select" on public.gallery;
create policy "gallery_authenticated_select"
on public.gallery
for select
to authenticated
using (
  (status = 'published' and deleted_at is null)
  or public.can_manage_organization(organization_id, hostel_id)
);

drop policy if exists "gallery_write_admin" on public.gallery;
drop policy if exists "gallery_insert_admin" on public.gallery;
create policy "gallery_insert_admin"
on public.gallery
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "gallery_update_admin" on public.gallery;
create policy "gallery_update_admin"
on public.gallery
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- website_settings
drop policy if exists "website_settings_public_published_select" on public.website_settings;
create policy "website_settings_public_published_select"
on public.website_settings
for select
to anon
using (status = 'published' and deleted_at is null);

drop policy if exists "website_settings_authenticated_select" on public.website_settings;
create policy "website_settings_authenticated_select"
on public.website_settings
for select
to authenticated
using (
  (status = 'published' and deleted_at is null)
  or public.can_manage_organization(organization_id, hostel_id)
);

drop policy if exists "website_settings_write_admin" on public.website_settings;
drop policy if exists "website_settings_insert_admin" on public.website_settings;
create policy "website_settings_insert_admin"
on public.website_settings
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "website_settings_update_admin" on public.website_settings;
create policy "website_settings_update_admin"
on public.website_settings
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- facilities
drop policy if exists "facilities_public_published_select" on public.facilities;
create policy "facilities_public_published_select"
on public.facilities
for select
to anon
using (status = 'published' and deleted_at is null);

drop policy if exists "facilities_authenticated_select" on public.facilities;
create policy "facilities_authenticated_select"
on public.facilities
for select
to authenticated
using (
  (status = 'published' and deleted_at is null)
  or public.can_manage_organization(organization_id, hostel_id)
);

drop policy if exists "facilities_write_admin" on public.facilities;
drop policy if exists "facilities_insert_admin" on public.facilities;
create policy "facilities_insert_admin"
on public.facilities
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "facilities_update_admin" on public.facilities;
create policy "facilities_update_admin"
on public.facilities
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- support_requests
drop policy if exists "support_requests_select_owner_or_admin" on public.support_requests;
create policy "support_requests_select_owner_or_admin"
on public.support_requests
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
  or created_by_user_id = public.get_current_user_id()
);

drop policy if exists "support_requests_insert_owner_or_admin" on public.support_requests;
create policy "support_requests_insert_owner_or_admin"
on public.support_requests
for insert
to authenticated
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
  or created_by_user_id = public.get_current_user_id()
);

drop policy if exists "support_requests_update_admin" on public.support_requests;
create policy "support_requests_update_admin"
on public.support_requests
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- audit_logs
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using (
  public.is_super_admin()
  or (organization_id is not null and public.has_role_in_organization(organization_id, array['owner', 'admin']::public.user_role_enum[], hostel_id))
);

drop policy if exists "audit_logs_insert_admin" on public.audit_logs;
create policy "audit_logs_insert_admin"
on public.audit_logs
for insert
to authenticated
with check (
  public.is_super_admin()
  or (organization_id is not null and public.has_role_in_organization(organization_id, array['owner', 'admin']::public.user_role_enum[], hostel_id))
);

-- payment_webhooks
drop policy if exists "payment_webhooks_select_finance_admin" on public.payment_webhooks;
create policy "payment_webhooks_select_finance_admin"
on public.payment_webhooks
for select
to authenticated
using (
  public.is_super_admin()
  or (organization_id is not null and public.can_manage_finance(organization_id, hostel_id))
);

-- notification_logs
drop policy if exists "notification_logs_select_admin" on public.notification_logs;
create policy "notification_logs_select_admin"
on public.notification_logs
for select
to authenticated
using (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "notification_logs_insert_admin" on public.notification_logs;
create policy "notification_logs_insert_admin"
on public.notification_logs
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

-- ---------------------------------------------------------------------------
-- Supabase Storage buckets and policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'resident-documents',
    'resident-documents',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
  ),
  (
    'payment-screenshots',
    'payment-screenshots',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
  ),
  (
    'gallery-images',
    'gallery-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'invoices',
    'invoices',
    false,
    10485760,
    array['application/pdf']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Supabase owns and manages RLS for storage.objects. Do not run ownership-level
-- ALTER TABLE statements on managed storage tables from project migrations.

drop policy if exists "storage_gallery_public_read" on storage.objects;
create policy "storage_gallery_public_read"
on storage.objects
for select
to anon
using (bucket_id = 'gallery-images');

drop policy if exists "storage_authenticated_gallery_read" on storage.objects;
create policy "storage_authenticated_gallery_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'gallery-images'
  or public.can_manage_organization(public.storage_object_organization_id(name))
);

drop policy if exists "storage_admin_manage_organization_files" on storage.objects;
create policy "storage_admin_manage_organization_files"
on storage.objects
for all
to authenticated
using (
  bucket_id in ('resident-documents', 'payment-screenshots', 'gallery-images', 'invoices')
  and public.can_manage_organization(public.storage_object_organization_id(name))
)
with check (
  bucket_id in ('resident-documents', 'payment-screenshots', 'gallery-images', 'invoices')
  and public.can_manage_organization(public.storage_object_organization_id(name))
);

drop policy if exists "storage_resident_read_own_documents" on storage.objects;
create policy "storage_resident_read_own_documents"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('resident-documents', 'payment-screenshots', 'invoices')
  and public.belongs_to_organization(public.storage_object_organization_id(name))
  and public.owns_resident(public.storage_object_resident_id(name))
);

drop policy if exists "storage_resident_upload_own_documents" on storage.objects;
create policy "storage_resident_upload_own_documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('resident-documents', 'payment-screenshots')
  and public.belongs_to_organization(public.storage_object_organization_id(name))
  and public.owns_resident(public.storage_object_resident_id(name))
);

drop policy if exists "storage_resident_update_own_documents" on storage.objects;
create policy "storage_resident_update_own_documents"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('resident-documents', 'payment-screenshots')
  and public.belongs_to_organization(public.storage_object_organization_id(name))
  and public.owns_resident(public.storage_object_resident_id(name))
)
with check (
  bucket_id in ('resident-documents', 'payment-screenshots')
  and public.belongs_to_organization(public.storage_object_organization_id(name))
  and public.owns_resident(public.storage_object_resident_id(name))
);

drop policy if exists "storage_resident_delete_own_documents" on storage.objects;
create policy "storage_resident_delete_own_documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('resident-documents', 'payment-screenshots')
  and public.belongs_to_organization(public.storage_object_organization_id(name))
  and public.owns_resident(public.storage_object_resident_id(name))
);

commit;
