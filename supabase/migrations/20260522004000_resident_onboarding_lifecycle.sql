-- Resident onboarding lifecycle hardening.
-- Adds explicit onboarding states, required document tracking, verification audit
-- columns, and a guarded transition function for admin review.

alter type public.document_type_enum add value if not exists 'student_id';

do $$
begin
  create type public.resident_onboarding_status_enum as enum (
    'invited',
    'activated',
    'profile_incomplete',
    'documents_pending',
    'verification_pending',
    'verified',
    'rejected',
    'suspended'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.residents
  add column if not exists onboarding_status public.resident_onboarding_status_enum not null default 'invited',
  add column if not exists student_id_document_id uuid references public.documents(id) on delete set null,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_verified_at timestamptz,
  add column if not exists onboarding_verified_by uuid references public.users(id) on delete set null,
  add column if not exists onboarding_rejection_reason text,
  add column if not exists onboarding_metadata jsonb not null default '{}'::jsonb;

create index if not exists residents_onboarding_queue_idx
  on public.residents (organization_id, hostel_id, onboarding_status, updated_at desc)
  where deleted_at is null;

create index if not exists residents_student_id_document_idx
  on public.residents (student_id_document_id)
  where student_id_document_id is not null;

create unique index if not exists residents_phone_active_uidx
  on public.residents (organization_id, phone)
  where phone is not null and deleted_at is null and is_active = true;

create unique index if not exists residents_aadhaar_last4_name_uidx
  on public.residents (organization_id, lower(full_name), aadhaar_last4)
  where aadhaar_last4 is not null and deleted_at is null and is_active = true;

-- Protected migration pattern:
-- Runtime resident profile protections intentionally block direct profile
-- updates. Legacy onboarding backfills therefore run through a fixed-scope,
-- SECURITY DEFINER helper that briefly disables only the resident profile
-- protection trigger inside this transaction, writes audit rows, and always
-- re-enables the trigger. Normal authenticated users cannot call this helper.
create or replace function public.backfill_resident_onboarding_status_for_migration()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
  v_trigger_disabled boolean := false;
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.residents'::regclass
      and tgname = 'protect_resident_profile_update'
      and not tgisinternal
  ) then
    execute 'alter table public.residents disable trigger protect_resident_profile_update';
    v_trigger_disabled := true;
  end if;

  with updated_rows as (
    update public.residents
    set
      onboarding_status = 'verified',
      onboarding_completed_at = coalesce(onboarding_completed_at, updated_at),
      onboarding_verified_at = coalesce(onboarding_verified_at, updated_at),
      onboarding_metadata = onboarding_metadata || jsonb_build_object('legacy_verification', true)
    where status = 'active'
      and user_id is not null
      and onboarding_status <> 'verified'
    returning
      id,
      organization_id,
      hostel_id,
      onboarding_status,
      onboarding_completed_at,
      onboarding_verified_at,
      onboarding_metadata
  )
  insert into public.audit_logs (
    organization_id,
    hostel_id,
    table_name,
    record_id,
    action,
    new_values,
    metadata
  )
  select
    organization_id,
    hostel_id,
    'residents',
    id,
    'resident.onboarding_legacy_backfill',
    jsonb_build_object(
      'onboarding_status', onboarding_status,
      'onboarding_completed_at', onboarding_completed_at,
      'onboarding_verified_at', onboarding_verified_at
    ),
    jsonb_build_object(
      'source', '20260522004000_resident_onboarding_lifecycle',
      'legacy_verification', onboarding_metadata->>'legacy_verification'
    )
  from updated_rows;

  get diagnostics v_updated_count = row_count;

  if v_trigger_disabled then
    execute 'alter table public.residents enable trigger protect_resident_profile_update';
    v_trigger_disabled := false;
  end if;

  return v_updated_count;
exception
  when others then
    if v_trigger_disabled then
      begin
        execute 'alter table public.residents enable trigger protect_resident_profile_update';
      exception
        when others then null;
      end;
    end if;
    raise;
end;
$$;

revoke execute on function public.backfill_resident_onboarding_status_for_migration()
from public, anon, authenticated;
grant execute on function public.backfill_resident_onboarding_status_for_migration()
to service_role;

select public.backfill_resident_onboarding_status_for_migration();

create or replace function public.validate_resident_onboarding_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.onboarding_status = 'verified'
     and coalesce(new.onboarding_metadata->>'legacy_verification', 'false') <> 'true'
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

  if new.onboarding_status = 'rejected'
     and nullif(trim(coalesce(new.onboarding_rejection_reason, '')), '') is null then
    raise exception 'resident_onboarding_rejection_reason_required' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_resident_onboarding_status on public.residents;
create trigger validate_resident_onboarding_status
before insert or update of
  onboarding_status,
  full_name,
  date_of_birth,
  phone,
  parent_name,
  parent_phone,
  emergency_contact_name,
  emergency_contact_phone,
  permanent_address,
  aadhaar_document_id,
  profile_image_document_id,
  student_id_document_id,
  onboarding_rejection_reason,
  onboarding_metadata
on public.residents
for each row execute function public.validate_resident_onboarding_status();

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
  v_allowed boolean := false;
begin
  if p_actor_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.can_manage_organization(p_organization_id) then
    raise exception 'resident_onboarding_forbidden' using errcode = '42501';
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
    jsonb_build_object('next_status', p_next_status, 'previous_status', v_resident.onboarding_status),
    p_actor_user_id,
    p_actor_user_id
  );

  return v_resident;
end;
$$;

revoke execute on function public.transition_resident_onboarding_atomic(
  uuid, uuid, public.resident_onboarding_status_enum, text, uuid
) from public, anon;
grant execute on function public.transition_resident_onboarding_atomic(
  uuid, uuid, public.resident_onboarding_status_enum, text, uuid
) to authenticated, service_role;
