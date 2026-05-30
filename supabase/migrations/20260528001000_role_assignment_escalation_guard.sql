-- Role assignment escalation guard.
-- Defense-in-depth for direct Supabase clients: application services already
-- restrict IAM writes, but RLS table access must also prevent privilege
-- escalation if a privileged user bypasses the API layer.

begin;

create or replace function public.can_assign_user_role(
  p_organization_id uuid,
  p_hostel_id uuid,
  p_target_role public.user_role_enum
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    public.is_service_context()
    or public.is_super_admin()
    or (
      p_target_role in ('owner', 'admin')
      and public.has_role_in_organization(
        p_organization_id,
        array['owner']::public.user_role_enum[],
        p_hostel_id
      )
    )
    or (
      p_target_role in ('finance', 'receptionist', 'warden', 'staff')
      and public.has_role_in_organization(
        p_organization_id,
        array['owner', 'admin']::public.user_role_enum[],
        p_hostel_id
      )
    )
    or (
      p_target_role in ('resident', 'parent')
      and public.can_manage_organization(p_organization_id, p_hostel_id)
    );
$$;

comment on function public.can_assign_user_role(uuid, uuid, public.user_role_enum) is
  'Role-assignment guard used by IAM RPCs and user_roles triggers. Super admin requires service/super-admin, owner/admin require an owner, operational staff roles require owner/admin, resident/parent require tenant operations access.';

create or replace function public.is_recent_self_tenant_bootstrap_owner(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_target_role public.user_role_enum
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p_target_role = 'owner'::public.user_role_enum
    and p_target_user_id = auth.uid()
    and exists (
      select 1
      from public.users u
      join public.organizations o
        on o.id = p_organization_id
       and o.created_by = u.id
       and o.deleted_at is null
       and o.created_at >= now() - interval '10 minutes'
      where u.id = auth.uid()
        and u.organization_id = p_organization_id
        and u.default_role in ('super_admin', 'owner')
        and u.is_active is true
        and u.deleted_at is null
    );
$$;

comment on function public.is_recent_self_tenant_bootstrap_owner(uuid, uuid, public.user_role_enum) is
  'Allows the admin setup bootstrap RPC to attach the creating user as owner of the tenant it just created, while keeping direct cross-tenant owner grants blocked.';

create or replace function public.protect_user_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_last_privileged_role boolean;
begin
  if public.is_service_context() or public.is_super_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if v_actor_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.role = 'super_admin'::public.user_role_enum then
      raise exception 'super_admin_role_assignment_forbidden' using errcode = '42501';
    end if;

    if not (
      public.can_assign_user_role(new.organization_id, new.hostel_id, new.role)
      or public.is_recent_self_tenant_bootstrap_owner(new.organization_id, new.user_id, new.role)
    ) then
      raise exception 'role_assignment_forbidden' using errcode = '42501';
    end if;

    if (
      new.role in ('owner', 'admin')
      and not (
        public.has_role_in_organization(
          new.organization_id,
          array['owner']::public.user_role_enum[],
          new.hostel_id
        )
        or public.is_recent_self_tenant_bootstrap_owner(new.organization_id, new.user_id, new.role)
      )
    ) then
      raise exception 'privileged_role_assignment_requires_owner' using errcode = '42501';
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE')
     and old.role in ('owner', 'admin')
     and old.status = 'active'
     and old.deleted_at is null then
    if tg_op = 'DELETE' then
      v_is_last_privileged_role := true;
    else
      v_is_last_privileged_role := (
        new.organization_id is distinct from old.organization_id
        or new.user_id is distinct from old.user_id
        or new.role not in ('owner', 'admin')
        or new.status <> 'active'
        or new.deleted_at is not null
      );
    end if;

    if v_is_last_privileged_role
       and not exists (
         select 1
         from public.user_roles ur
         where ur.id <> old.id
           and ur.organization_id = old.organization_id
           and ur.role in ('owner', 'admin')
           and ur.status = 'active'
           and ur.deleted_at is null
       ) then
      raise exception 'last_privileged_user_role_blocked' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_user_role_assignment on public.user_roles;
create trigger protect_user_role_assignment
before insert or update or delete on public.user_roles
for each row
execute function public.protect_user_role_assignment();

drop policy if exists "documents_insert_owner_or_admin" on public.documents;
create policy "documents_insert_owner_or_admin"
on public.documents
for insert
to authenticated
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or (
    public.owns_resident(resident_id)
    and document_type in (
      'aadhaar',
      'profile_image',
      'student_id',
      'guardian_id',
      'payment_receipt',
      'support_attachment'
    )
    and is_public = false
  )
);

create or replace function public.protect_resident_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_protected_changed boolean;
  v_self_allowed_changed boolean;
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
    if old.status in ('suspended', 'checked_out', 'archived')
       or old.deleted_at is not null
       or old.onboarding_status in ('verified', 'suspended') then
      raise exception 'resident_profile_self_update_locked' using errcode = '42501';
    end if;

    if new.onboarding_status in ('verified', 'suspended')
       and new.onboarding_status is distinct from old.onboarding_status then
      raise exception 'resident_onboarding_self_transition_forbidden' using errcode = '42501';
    end if;

    if new.onboarding_status = 'verification_pending'::public.resident_onboarding_status_enum
       and (
         nullif(trim(coalesce(new.full_name, '')), '') is null
         or new.date_of_birth is null
         or nullif(trim(coalesce(new.phone, '')), '') is null
         or nullif(trim(coalesce(new.parent_name, '')), '') is null
         or nullif(trim(coalesce(new.parent_phone, '')), '') is null
         or nullif(trim(coalesce(new.emergency_contact_name, '')), '') is null
         or nullif(trim(coalesce(new.emergency_contact_phone, '')), '') is null
         or nullif(trim(coalesce(new.permanent_address, '')), '') is null
         or new.aadhaar_document_id is null
         or new.profile_image_document_id is null
         or new.student_id_document_id is null
       ) then
      raise exception 'resident_onboarding_requirements_missing' using errcode = '23514';
    end if;

    v_self_allowed_changed := (
      to_jsonb(new)
        - 'full_name'
        - 'preferred_name'
        - 'gender'
        - 'date_of_birth'
        - 'phone'
        - 'email'
        - 'aadhaar_last4'
        - 'aadhaar_document_id'
        - 'profile_image_document_id'
        - 'student_id_document_id'
        - 'parent_name'
        - 'parent_phone'
        - 'parent_email'
        - 'emergency_contact_name'
        - 'emergency_contact_phone'
        - 'permanent_address'
        - 'metadata'
        - 'onboarding_status'
        - 'onboarding_completed_at'
        - 'onboarding_rejection_reason'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
        - 'search_vector'
    ) is not distinct from (
      to_jsonb(old)
        - 'full_name'
        - 'preferred_name'
        - 'gender'
        - 'date_of_birth'
        - 'phone'
        - 'email'
        - 'aadhaar_last4'
        - 'aadhaar_document_id'
        - 'profile_image_document_id'
        - 'student_id_document_id'
        - 'parent_name'
        - 'parent_phone'
        - 'parent_email'
        - 'emergency_contact_name'
        - 'emergency_contact_phone'
        - 'permanent_address'
        - 'metadata'
        - 'onboarding_status'
        - 'onboarding_completed_at'
        - 'onboarding_rejection_reason'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
        - 'search_vector'
    );

    if not v_self_allowed_changed then
      raise exception 'resident_profile_self_update_protected_fields' using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update resident profile' using errcode = '42501';
end;
$$;

create or replace function public.transition_resident_onboarding_atomic(
  p_resident_id uuid,
  p_organization_id uuid,
  p_next_status public.resident_onboarding_status_enum,
  p_rejection_reason text default null,
  p_actor_user_id uuid default auth.uid()
)
returns public.residents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_resident public.residents;
  v_previous_status public.resident_onboarding_status_enum;
  v_allowed boolean := false;
  v_is_admin_transition boolean := false;
  v_is_self_submission boolean := false;
  v_requested_room_id uuid;
  v_requested_bed_label text;
  v_requested_allocated_from date;
  v_existing_allocation public.room_allocations;
begin
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'auth_required' using errcode = '28000';
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

  v_is_admin_transition := public.can_manage_organization(
    v_resident.organization_id,
    v_resident.hostel_id
  );
  v_is_self_submission := public.owns_resident(v_resident.id)
    and p_next_status = 'verification_pending'::public.resident_onboarding_status_enum;

  if not (v_is_admin_transition or v_is_self_submission) then
    raise exception 'resident_onboarding_forbidden' using errcode = '42501';
  end if;

  if v_is_self_submission and (
    v_resident.status in ('suspended', 'checked_out', 'archived')
    or v_resident.checkout_on is not null
    or v_resident.user_id is null
    or nullif(trim(coalesce(v_resident.full_name, '')), '') is null
    or v_resident.date_of_birth is null
    or nullif(trim(coalesce(v_resident.phone, '')), '') is null
    or nullif(trim(coalesce(v_resident.parent_name, '')), '') is null
    or nullif(trim(coalesce(v_resident.parent_phone, '')), '') is null
    or nullif(trim(coalesce(v_resident.emergency_contact_name, '')), '') is null
    or nullif(trim(coalesce(v_resident.emergency_contact_phone, '')), '') is null
    or nullif(trim(coalesce(v_resident.permanent_address, '')), '') is null
    or v_resident.aadhaar_document_id is null
    or v_resident.profile_image_document_id is null
    or v_resident.student_id_document_id is null
  ) then
    raise exception 'resident_onboarding_requirements_missing' using errcode = '23514';
  end if;

  v_previous_status := v_resident.onboarding_status;

  v_allowed := case v_resident.onboarding_status
    when 'invited' then p_next_status in ('activated', 'profile_incomplete', 'suspended')
    when 'activated' then p_next_status in ('profile_incomplete', 'documents_pending', 'verification_pending', 'suspended')
    when 'profile_incomplete' then p_next_status in ('documents_pending', 'verification_pending', 'rejected', 'suspended')
    when 'documents_pending' then p_next_status in ('verification_pending', 'rejected', 'suspended')
    when 'verification_pending' then p_next_status in ('verified', 'rejected', 'suspended')
    when 'verified' then p_next_status in ('suspended')
    when 'rejected' then p_next_status in ('profile_incomplete', 'documents_pending', 'verification_pending', 'suspended')
    when 'suspended' then p_next_status in ('profile_incomplete', 'documents_pending', 'verification_pending', 'verified')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_onboarding_transition' using errcode = '23514';
  end if;

  if v_is_self_submission and p_next_status <> 'verification_pending' then
    raise exception 'resident_onboarding_self_transition_forbidden' using errcode = '42501';
  end if;

  update public.residents
  set
    onboarding_status = p_next_status,
    onboarding_rejection_reason = case
      when p_next_status = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '')
      else null
    end,
    onboarding_completed_at = case
      when p_next_status in ('verification_pending', 'verified') then coalesce(onboarding_completed_at, now())
      else onboarding_completed_at
    end,
    onboarding_verified_at = case
      when p_next_status = 'verified' then now()
      else null
    end,
    onboarding_verified_by = case
      when p_next_status = 'verified' then p_actor_user_id
      else null
    end,
    status = case
      when p_next_status = 'verified' then 'active'::public.resident_status_enum
      when p_next_status = 'suspended' then 'suspended'::public.resident_status_enum
      else status
    end,
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_resident_id
    and organization_id = p_organization_id
  returning * into v_resident;

  if p_next_status = 'verified' then
    v_requested_room_id := nullif(v_resident.metadata #>> '{requested_room_assignment,room_id}', '')::uuid;
    v_requested_bed_label := nullif(v_resident.metadata #>> '{requested_room_assignment,bed_label}', '');
    v_requested_allocated_from := coalesce(
      nullif(v_resident.metadata #>> '{requested_room_assignment,allocated_from}', '')::date,
      current_date
    );

    if v_requested_room_id is not null then
      select *
      into v_existing_allocation
      from public.room_allocations
      where organization_id = p_organization_id
        and resident_id = p_resident_id
        and status = 'active'
        and deleted_at is null
      for update;

      if not found then
        perform public.allocate_room_atomic(
          p_organization_id,
          v_resident.hostel_id,
          v_requested_room_id,
          v_resident.id,
          v_requested_bed_label,
          v_requested_allocated_from,
          null,
          nullif(v_resident.monthly_fee_amount, 0),
          'Onboarding verified; activating preferred room from admission reservation.',
          p_actor_user_id
        );

        select *
        into v_resident
        from public.residents
        where id = p_resident_id
          and organization_id = p_organization_id;
      end if;
    end if;
  end if;

  if v_is_admin_transition then
    insert into public.audit_logs (
      organization_id,
      hostel_id,
      actor_user_id,
      table_name,
      record_id,
      action,
      new_values,
      metadata,
      created_by,
      updated_by
    )
    values (
      p_organization_id,
      v_resident.hostel_id,
      p_actor_user_id,
      'residents',
      v_resident.id,
      'resident.onboarding_transition',
      to_jsonb(v_resident),
      jsonb_build_object(
        'next_status', p_next_status,
        'previous_status', v_previous_status,
        'preferred_room_activation_attempted', p_next_status = 'verified' and v_requested_room_id is not null
      ),
      p_actor_user_id,
      p_actor_user_id
    );
  end if;

  return v_resident;
end;
$$;

create or replace function public.assign_default_role(
  target_user_id uuid,
  target_organization_id uuid,
  target_hostel_id uuid default null,
  target_role public.user_role_enum default 'resident',
  role_permissions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  role_id uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if target_organization_id is null then
    raise exception 'target_organization_id is required';
  end if;

  if target_role = 'super_admin'::public.user_role_enum
     and not (public.is_service_context() or public.is_super_admin()) then
    raise exception 'super_admin_role_assignment_forbidden' using errcode = '42501';
  end if;

  if not public.can_assign_user_role(target_organization_id, target_hostel_id, target_role) then
    raise exception 'role_assignment_forbidden' using errcode = '42501';
  end if;

  perform public.sync_auth_user(target_user_id);

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
    target_organization_id,
    target_hostel_id,
    target_user_id,
    target_role,
    coalesce(role_permissions, '[]'::jsonb),
    'active',
    now(),
    nullif(public.get_current_user_id(), target_user_id),
    nullif(public.get_current_user_id(), target_user_id)
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
    accepted_at = coalesce(public.user_roles.accepted_at, now()),
    updated_at = now(),
    updated_by = excluded.updated_by
  returning id into role_id;

  update public.users
  set
    organization_id = coalesce(public.users.organization_id, target_organization_id),
    default_role = case
      when target_role in (
        'super_admin',
        'owner',
        'admin',
        'finance',
        'receptionist',
        'warden',
        'staff'
      ) then target_role
      else public.users.default_role
    end,
    updated_at = now()
  where id = target_user_id;

  return role_id;
end;
$$;

create or replace function public.onboard_admin(
  target_user_id uuid,
  target_organization_id uuid,
  target_hostel_id uuid default null,
  target_role public.user_role_enum default 'admin'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  role_id uuid;
begin
  if target_role not in ('owner', 'admin', 'finance', 'receptionist', 'warden', 'staff') then
    raise exception 'onboard_admin only supports staff and admin portal roles';
  end if;

  if target_organization_id is null then
    raise exception 'target_organization_id is required';
  end if;

  if not public.can_assign_user_role(target_organization_id, target_hostel_id, target_role) then
    raise exception 'role_assignment_forbidden' using errcode = '42501';
  end if;

  perform public.sync_auth_user(target_user_id);

  role_id := public.assign_default_role(
    target_user_id,
    target_organization_id,
    target_hostel_id,
    target_role,
    case target_role
      when 'owner' then jsonb_build_array('organization.manage', 'finance.manage', 'cms.manage', 'roles.manage')
      when 'admin' then jsonb_build_array('residents.manage', 'rooms.manage', 'finance.manage', 'cms.manage', 'notices.manage')
      when 'finance' then jsonb_build_array('finance.manage', 'payments.verify', 'reports.export')
      when 'receptionist' then jsonb_build_array('admissions.manage', 'residents.manage', 'notices.manage')
      when 'warden' then jsonb_build_array('residents.manage', 'rooms.manage', 'leaves.manage', 'notices.manage')
      else jsonb_build_array('residents.read', 'rooms.read', 'leaves.manage', 'notices.manage')
    end
  );

  update public.users
  set
    organization_id = target_organization_id,
    default_role = target_role,
    is_active = true,
    updated_at = now()
  where id = target_user_id;

  return role_id;
end;
$$;

revoke all on function public.can_assign_user_role(uuid, uuid, public.user_role_enum)
  from public, anon;
grant execute on function public.can_assign_user_role(uuid, uuid, public.user_role_enum)
  to authenticated, service_role;

revoke all on function public.is_recent_self_tenant_bootstrap_owner(uuid, uuid, public.user_role_enum)
  from public, anon;
grant execute on function public.is_recent_self_tenant_bootstrap_owner(uuid, uuid, public.user_role_enum)
  to authenticated, service_role;

revoke all on function public.protect_user_role_assignment()
  from public, anon;

revoke execute on function public.assign_default_role(uuid, uuid, uuid, public.user_role_enum, jsonb)
  from public, anon;
grant execute on function public.assign_default_role(uuid, uuid, uuid, public.user_role_enum, jsonb)
  to authenticated, service_role;

revoke execute on function public.onboard_admin(uuid, uuid, uuid, public.user_role_enum)
  from public, anon;
grant execute on function public.onboard_admin(uuid, uuid, uuid, public.user_role_enum)
  to authenticated, service_role;

commit;
