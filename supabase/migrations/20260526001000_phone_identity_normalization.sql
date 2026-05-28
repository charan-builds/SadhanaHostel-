-- Phone identity normalization hardening.
-- Canonicalizes Indian resident/staff phone identities to E.164 (+91XXXXXXXXXX)
-- so Supabase Auth, resident invites, login diagnostics, WhatsApp links, and
-- duplicate detection all compare the same value.

create or replace function public.normalize_indian_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_raw text := nullif(trim(coalesce(p_phone, '')), '');
  v_digits text;
  v_mobile text;
begin
  if v_raw is null then
    return null;
  end if;

  if v_raw ~ '[^+0-9().[:space:]-]' then
    return null;
  end if;

  v_digits := regexp_replace(v_raw, '\D', '', 'g');

  if left(v_raw, 1) = '+' then
    if left(v_digits, 2) <> '91' or length(v_digits) <> 12 then
      return null;
    end if;

    v_mobile := right(v_digits, 10);
  elsif left(v_digits, 4) = '0091' and length(v_digits) = 14 then
    v_mobile := right(v_digits, 10);
  elsif left(v_digits, 2) = '91' and length(v_digits) = 12 then
    v_mobile := right(v_digits, 10);
  elsif left(v_digits, 1) = '0' and length(v_digits) = 11 then
    v_mobile := right(v_digits, 10);
  elsif length(v_digits) = 10 then
    v_mobile := v_digits;
  else
    return null;
  end if;

  if v_mobile !~ '^[6-9][0-9]{9}$' then
    return null;
  end if;

  return '+91' || v_mobile;
end;
$$;

create or replace function public.require_normalized_indian_phone(
  p_phone text,
  p_column text
)
returns text
language plpgsql
immutable
as $$
declare
  v_normalized text;
begin
  if nullif(trim(coalesce(p_phone, '')), '') is null then
    return null;
  end if;

  v_normalized := public.normalize_indian_phone(p_phone);

  if v_normalized is null then
    raise exception 'invalid_phone_identity:%', p_column using errcode = '22023';
  end if;

  return v_normalized;
end;
$$;

create or replace function public.normalize_resident_phone_columns()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.require_normalized_indian_phone(new.phone, 'residents.phone');
  new.parent_phone := public.require_normalized_indian_phone(new.parent_phone, 'residents.parent_phone');
  new.emergency_contact_phone := public.require_normalized_indian_phone(
    new.emergency_contact_phone,
    'residents.emergency_contact_phone'
  );

  return new;
end;
$$;

create or replace function public.normalize_user_phone_columns()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.require_normalized_indian_phone(new.phone, 'users.phone');

  return new;
end;
$$;

create or replace function public.normalize_resident_invite_phone_columns()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.require_normalized_indian_phone(new.phone, 'resident_invites.phone');

  return new;
end;
$$;

create or replace function public.normalize_lead_phone_columns()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.require_normalized_indian_phone(new.phone, 'leads.phone');
  new.whatsapp_number := public.require_normalized_indian_phone(
    new.whatsapp_number,
    'leads.whatsapp_number'
  );
  new.parent_phone := public.require_normalized_indian_phone(new.parent_phone, 'leads.parent_phone');

  return new;
end;
$$;

-- Protected migration pattern:
-- Resident profile protection triggers intentionally block direct profile
-- mutations. Bulk data repairs must run through narrow, audited SECURITY
-- DEFINER helpers that are not executable by normal authenticated users.
-- This helper disables only the resident profile protection trigger while
-- normalizing phone columns, holds the table lock for the shortest practical
-- window, re-enables the trigger in success/failure paths, and leaves runtime
-- RLS/protection semantics unchanged after the migration commits.
create or replace function public.normalize_phone_identity_records_for_migration()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resident_phone_count integer := 0;
  v_resident_parent_phone_count integer := 0;
  v_resident_emergency_phone_count integer := 0;
  v_user_phone_count integer := 0;
  v_invite_phone_count integer := 0;
  v_lead_phone_count integer := 0;
  v_lead_whatsapp_count integer := 0;
  v_lead_parent_phone_count integer := 0;
  v_skipped_resident_duplicate_count integer := 0;
  v_tenantless_resident_count integer := 0;
  v_invalid_resident_organization_count integer := 0;
  v_invalid_resident_hostel_count integer := 0;
  v_orphan_resident_auth_linkage_count integer := 0;
  v_invalid_invite_resident_link_count integer := 0;
  v_trigger_disabled boolean := false;
  v_invite_tenant_trigger_disabled boolean := false;
begin
  create temp table if not exists phone_identity_normalization_audit_scope (
    organization_id uuid primary key
  ) on commit drop;

  truncate table pg_temp.phone_identity_normalization_audit_scope;

  select count(*)::integer
  into v_tenantless_resident_count
  from public.residents r
  where r.organization_id is null
    and r.deleted_at is null;

  select count(*)::integer
  into v_invalid_resident_organization_count
  from public.residents r
  where r.organization_id is not null
    and not exists (
      select 1
      from public.organizations o
      where o.id = r.organization_id
    )
    and r.deleted_at is null;

  select count(*)::integer
  into v_invalid_resident_hostel_count
  from public.residents r
  where r.organization_id is not null
    and (
      r.hostel_id is null
      or not exists (
        select 1
        from public.hostels h
        where h.id = r.hostel_id
          and h.organization_id = r.organization_id
      )
    )
    and r.deleted_at is null;

  select count(*)::integer
  into v_orphan_resident_auth_linkage_count
  from public.residents r
  where r.user_id is not null
    and not exists (
      select 1
      from public.users u
      where u.id = r.user_id
        and (
          r.organization_id is null
          or u.organization_id = r.organization_id
        )
    )
    and r.deleted_at is null;

  select count(*)::integer
  into v_invalid_invite_resident_link_count
  from public.resident_invites i
  where i.phone is not null
    and public.normalize_indian_phone(i.phone) is not null
    and i.phone is distinct from public.normalize_indian_phone(i.phone)
    and not exists (
      select 1
      from public.residents r
      where r.id = i.resident_id
        and r.organization_id = i.organization_id
        and r.hostel_id = i.hostel_id
    );

  select count(*)::integer
  into v_skipped_resident_duplicate_count
  from (
    select
      organization_id,
      public.normalize_indian_phone(phone) as normalized_phone
    from public.residents
    where phone is not null
      and organization_id is not null
      and exists (
        select 1
        from public.organizations o
        where o.id = public.residents.organization_id
      )
      and exists (
        select 1
        from public.hostels h
        where h.id = public.residents.hostel_id
          and h.organization_id = public.residents.organization_id
      )
      and deleted_at is null
      and is_active = true
      and public.normalize_indian_phone(phone) is not null
    group by organization_id, public.normalize_indian_phone(phone)
    having count(*) > 1
  ) duplicates;

  insert into pg_temp.phone_identity_normalization_audit_scope (organization_id)
  select distinct organization_id
  from public.residents
  where organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.residents.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.residents.hostel_id
        and h.organization_id = public.residents.organization_id
    )
    and (
      (
        phone is not null
        and public.normalize_indian_phone(phone) is not null
        and phone is distinct from public.normalize_indian_phone(phone)
      )
      or (
        parent_phone is not null
        and public.normalize_indian_phone(parent_phone) is not null
        and parent_phone is distinct from public.normalize_indian_phone(parent_phone)
      )
      or (
        emergency_contact_phone is not null
        and public.normalize_indian_phone(emergency_contact_phone) is not null
        and emergency_contact_phone is distinct from public.normalize_indian_phone(emergency_contact_phone)
      )
    )
  on conflict do nothing;

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

  with candidates as (
    select
      id,
      public.normalize_indian_phone(phone) as normalized_phone,
      (
        is_active = true
        and deleted_at is null
      ) as active_for_unique_index,
      count(*) filter (
        where
          is_active = true
          and deleted_at is null
      ) over (
        partition by organization_id, public.normalize_indian_phone(phone)
      ) as active_phone_count
    from public.residents
    where phone is not null
      and organization_id is not null
      and exists (
        select 1
        from public.organizations o
        where o.id = public.residents.organization_id
      )
      and exists (
        select 1
        from public.hostels h
        where h.id = public.residents.hostel_id
          and h.organization_id = public.residents.organization_id
      )
      and public.normalize_indian_phone(phone) is not null
  )
  update public.residents r
  set
    phone = c.normalized_phone,
    updated_at = now()
  from candidates c
  where r.id = c.id
    and r.phone is distinct from c.normalized_phone
    and (
      c.active_for_unique_index = false
      or c.active_phone_count = 1
    );
  get diagnostics v_resident_phone_count = row_count;

  update public.residents
  set
    parent_phone = public.normalize_indian_phone(parent_phone),
    updated_at = now()
  where parent_phone is not null
    and organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.residents.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.residents.hostel_id
        and h.organization_id = public.residents.organization_id
    )
    and public.normalize_indian_phone(parent_phone) is not null
    and parent_phone is distinct from public.normalize_indian_phone(parent_phone);
  get diagnostics v_resident_parent_phone_count = row_count;

  update public.residents
  set
    emergency_contact_phone = public.normalize_indian_phone(emergency_contact_phone),
    updated_at = now()
  where emergency_contact_phone is not null
    and organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.residents.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.residents.hostel_id
        and h.organization_id = public.residents.organization_id
    )
    and public.normalize_indian_phone(emergency_contact_phone) is not null
    and emergency_contact_phone is distinct from public.normalize_indian_phone(emergency_contact_phone);
  get diagnostics v_resident_emergency_phone_count = row_count;

  if v_trigger_disabled then
    execute 'alter table public.residents enable trigger protect_resident_profile_update';
    v_trigger_disabled := false;
  end if;

  insert into pg_temp.phone_identity_normalization_audit_scope (organization_id)
  select distinct organization_id
  from public.users
  where organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.users.organization_id
    )
    and phone is not null
    and public.normalize_indian_phone(phone) is not null
    and phone is distinct from public.normalize_indian_phone(phone)
  on conflict do nothing;

  update public.users
  set
    phone = public.normalize_indian_phone(phone),
    updated_at = now()
  where phone is not null
    and organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.users.organization_id
    )
    and public.normalize_indian_phone(phone) is not null
    and phone is distinct from public.normalize_indian_phone(phone);
  get diagnostics v_user_phone_count = row_count;

  insert into pg_temp.phone_identity_normalization_audit_scope (organization_id)
  select distinct organization_id
  from public.resident_invites
  where organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.resident_invites.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.resident_invites.hostel_id
        and h.organization_id = public.resident_invites.organization_id
    )
    and exists (
      select 1
      from public.residents r
      where r.id = public.resident_invites.resident_id
        and r.organization_id = public.resident_invites.organization_id
        and r.hostel_id = public.resident_invites.hostel_id
    )
    and phone is not null
    and public.normalize_indian_phone(phone) is not null
    and phone is distinct from public.normalize_indian_phone(phone)
  on conflict do nothing;

  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.resident_invites'::regclass
      and tgname = 'validate_resident_invites_tenant_scope'
      and not tgisinternal
  ) then
    execute 'alter table public.resident_invites disable trigger validate_resident_invites_tenant_scope';
    v_invite_tenant_trigger_disabled := true;
  end if;

  update public.resident_invites
  set
    phone = public.normalize_indian_phone(phone),
    updated_at = now()
  where phone is not null
    and organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.resident_invites.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.resident_invites.hostel_id
        and h.organization_id = public.resident_invites.organization_id
    )
    and exists (
      select 1
      from public.residents r
      where r.id = public.resident_invites.resident_id
        and r.organization_id = public.resident_invites.organization_id
        and r.hostel_id = public.resident_invites.hostel_id
    )
    and public.normalize_indian_phone(phone) is not null
    and phone is distinct from public.normalize_indian_phone(phone);
  get diagnostics v_invite_phone_count = row_count;

  if v_invite_tenant_trigger_disabled then
    execute 'alter table public.resident_invites enable trigger validate_resident_invites_tenant_scope';
    v_invite_tenant_trigger_disabled := false;
  end if;

  insert into pg_temp.phone_identity_normalization_audit_scope (organization_id)
  select distinct organization_id
  from public.leads
  where organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.leads.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.leads.hostel_id
        and h.organization_id = public.leads.organization_id
    )
    and (
      (
        phone is not null
        and public.normalize_indian_phone(phone) is not null
        and phone is distinct from public.normalize_indian_phone(phone)
      )
      or (
        whatsapp_number is not null
        and public.normalize_indian_phone(whatsapp_number) is not null
        and whatsapp_number is distinct from public.normalize_indian_phone(whatsapp_number)
      )
      or (
        parent_phone is not null
        and public.normalize_indian_phone(parent_phone) is not null
        and parent_phone is distinct from public.normalize_indian_phone(parent_phone)
      )
    )
  on conflict do nothing;

  update public.leads
  set
    phone = public.normalize_indian_phone(phone),
    updated_at = now()
  where phone is not null
    and organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.leads.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.leads.hostel_id
        and h.organization_id = public.leads.organization_id
    )
    and public.normalize_indian_phone(phone) is not null
    and phone is distinct from public.normalize_indian_phone(phone);
  get diagnostics v_lead_phone_count = row_count;

  update public.leads
  set
    whatsapp_number = public.normalize_indian_phone(whatsapp_number),
    updated_at = now()
  where whatsapp_number is not null
    and organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.leads.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.leads.hostel_id
        and h.organization_id = public.leads.organization_id
    )
    and public.normalize_indian_phone(whatsapp_number) is not null
    and whatsapp_number is distinct from public.normalize_indian_phone(whatsapp_number);
  get diagnostics v_lead_whatsapp_count = row_count;

  update public.leads
  set
    parent_phone = public.normalize_indian_phone(parent_phone),
    updated_at = now()
  where parent_phone is not null
    and organization_id is not null
    and exists (
      select 1
      from public.organizations o
      where o.id = public.leads.organization_id
    )
    and exists (
      select 1
      from public.hostels h
      where h.id = public.leads.hostel_id
        and h.organization_id = public.leads.organization_id
    )
    and public.normalize_indian_phone(parent_phone) is not null
    and parent_phone is distinct from public.normalize_indian_phone(parent_phone);
  get diagnostics v_lead_parent_phone_count = row_count;

  insert into public.audit_logs (
    organization_id,
    hostel_id,
    actor_user_id,
    table_name,
    action,
    metadata
  )
  select
    scope.organization_id,
    null,
    null,
    'phone_identity',
    'phone_identity.migration_normalization',
    jsonb_build_object(
      'source', '20260526001000_phone_identity_normalization',
      'resident_phone_rows', v_resident_phone_count,
      'resident_parent_phone_rows', v_resident_parent_phone_count,
      'resident_emergency_phone_rows', v_resident_emergency_phone_count,
      'user_phone_rows', v_user_phone_count,
      'resident_invite_phone_rows', v_invite_phone_count,
      'lead_phone_rows', v_lead_phone_count,
      'lead_whatsapp_rows', v_lead_whatsapp_count,
      'lead_parent_phone_rows', v_lead_parent_phone_count,
      'skipped_resident_duplicate_phone_groups', v_skipped_resident_duplicate_count,
      'tenantless_resident_rows_skipped', v_tenantless_resident_count,
      'invalid_resident_organization_rows_skipped', v_invalid_resident_organization_count,
      'invalid_resident_hostel_rows_skipped', v_invalid_resident_hostel_count,
      'orphan_resident_auth_linkage_rows_skipped', v_orphan_resident_auth_linkage_count,
      'invalid_invite_resident_link_rows_skipped', v_invalid_invite_resident_link_count
    )
  from pg_temp.phone_identity_normalization_audit_scope scope;

  if (
    v_tenantless_resident_count
    + v_invalid_resident_organization_count
    + v_invalid_resident_hostel_count
    + v_orphan_resident_auth_linkage_count
    + v_invalid_invite_resident_link_count
  ) > 0 then
    insert into public.audit_logs (
      organization_id,
      hostel_id,
      actor_user_id,
      table_name,
      action,
      metadata
    )
    values (
      null,
      null,
      null,
      'residents',
      'tenant_identity.orphan_rows_detected',
      jsonb_build_object(
        'source', '20260526001000_phone_identity_normalization',
        'tenantless_resident_rows_skipped', v_tenantless_resident_count,
        'invalid_resident_organization_rows_skipped', v_invalid_resident_organization_count,
        'invalid_resident_hostel_rows_skipped', v_invalid_resident_hostel_count,
        'orphan_resident_auth_linkage_rows_skipped', v_orphan_resident_auth_linkage_count,
        'invalid_invite_resident_link_rows_skipped', v_invalid_invite_resident_link_count,
        'recommended_action', 'Admin -> Operations -> Tenant Consistency Repair'
      )
    );
  end if;

  return jsonb_build_object(
    'residentPhoneRows', v_resident_phone_count,
    'residentParentPhoneRows', v_resident_parent_phone_count,
    'residentEmergencyPhoneRows', v_resident_emergency_phone_count,
    'userPhoneRows', v_user_phone_count,
    'residentInvitePhoneRows', v_invite_phone_count,
    'leadPhoneRows', v_lead_phone_count,
    'leadWhatsappRows', v_lead_whatsapp_count,
    'leadParentPhoneRows', v_lead_parent_phone_count,
    'skippedResidentDuplicatePhoneGroups', v_skipped_resident_duplicate_count,
    'tenantlessResidentRowsSkipped', v_tenantless_resident_count,
    'invalidResidentOrganizationRowsSkipped', v_invalid_resident_organization_count,
    'invalidResidentHostelRowsSkipped', v_invalid_resident_hostel_count,
    'orphanResidentAuthLinkageRowsSkipped', v_orphan_resident_auth_linkage_count,
    'invalidInviteResidentLinkRowsSkipped', v_invalid_invite_resident_link_count
  );
exception
  when others then
    if v_trigger_disabled then
      execute 'alter table public.residents enable trigger protect_resident_profile_update';
    end if;

    if v_invite_tenant_trigger_disabled then
      execute 'alter table public.resident_invites enable trigger validate_resident_invites_tenant_scope';
    end if;

    raise;
end;
$$;

revoke execute on function public.normalize_phone_identity_records_for_migration()
  from public, anon, authenticated;
grant execute on function public.normalize_phone_identity_records_for_migration()
  to service_role;

select public.normalize_phone_identity_records_for_migration();

create index if not exists residents_phone_e164_lookup_idx
  on public.residents (organization_id, public.normalize_indian_phone(phone))
  where organization_id is not null and phone is not null and deleted_at is null;

create index if not exists users_phone_e164_lookup_idx
  on public.users (organization_id, public.normalize_indian_phone(phone))
  where organization_id is not null and phone is not null and deleted_at is null;

create index if not exists resident_invites_phone_e164_lookup_idx
  on public.resident_invites (organization_id, public.normalize_indian_phone(phone))
  where organization_id is not null and phone is not null;

create or replace view public.phone_identity_normalization_anomalies
with (security_invoker = true)
as
select
  'residents'::text as table_name,
  id as record_id,
  organization_id,
  hostel_id,
  phone as actual_phone,
  public.normalize_indian_phone(phone) as expected_phone,
  case
    when public.normalize_indian_phone(phone) is null then 'invalid_phone'
    when phone is distinct from public.normalize_indian_phone(phone) then 'not_e164'
    else 'ok'
  end as anomaly_type
from public.residents
where phone is not null
  and deleted_at is null
  and (
    public.normalize_indian_phone(phone) is null
    or phone is distinct from public.normalize_indian_phone(phone)
  )
union all
select
  'resident_invites'::text as table_name,
  id as record_id,
  organization_id,
  hostel_id,
  phone as actual_phone,
  public.normalize_indian_phone(phone) as expected_phone,
  case
    when public.normalize_indian_phone(phone) is null then 'invalid_phone'
    when phone is distinct from public.normalize_indian_phone(phone) then 'not_e164'
    else 'ok'
  end as anomaly_type
from public.resident_invites
where phone is not null
  and (
    public.normalize_indian_phone(phone) is null
    or phone is distinct from public.normalize_indian_phone(phone)
  )
union all
select
  'users'::text as table_name,
  id as record_id,
  organization_id,
  null::uuid as hostel_id,
  phone as actual_phone,
  public.normalize_indian_phone(phone) as expected_phone,
  case
    when public.normalize_indian_phone(phone) is null then 'invalid_phone'
    when phone is distinct from public.normalize_indian_phone(phone) then 'not_e164'
    else 'ok'
  end as anomaly_type
from public.users
where phone is not null
  and deleted_at is null
  and (
    public.normalize_indian_phone(phone) is null
    or phone is distinct from public.normalize_indian_phone(phone)
  );

create or replace view public.resident_tenant_identity_anomalies
as
select
  'residents'::text as table_name,
  r.id as record_id,
  r.id as resident_id,
  r.organization_id,
  r.hostel_id,
  r.user_id,
  coalesce(h.organization_id, u.organization_id) as expected_organization_id,
  h.id as expected_hostel_id,
  'resident_missing_organization_id'::text as anomaly_type,
  'resident has a valid organization_id before normalization, onboarding, auth linkage, and billing'::text as expected_state,
  'resident.organization_id is null'::text as actual_state,
  'review_manually'::text as recommended_repair_action,
  'Do not auto-assign a tenant. Review original invite, hostel, auth user, and audit history before repairing or archiving this resident.'::text as recommendation
from public.residents r
left join public.hostels h on h.id = r.hostel_id
left join public.users u on u.id = r.user_id
where r.deleted_at is null
  and r.organization_id is null
union all
select
  'residents'::text,
  r.id,
  r.id,
  r.organization_id,
  r.hostel_id,
  r.user_id,
  null::uuid,
  null::uuid,
  'resident_invalid_organization_id'::text,
  'resident.organization_id references an existing organization'::text,
  'resident.organization_id does not reference an existing organization'::text,
  'review_manually'::text,
  'Archive or manually relink only after confirming the correct organization from source records.'::text
from public.residents r
left join public.organizations o on o.id = r.organization_id
where r.deleted_at is null
  and r.organization_id is not null
  and o.id is null
union all
select
  'residents'::text,
  r.id,
  r.id,
  r.organization_id,
  r.hostel_id,
  r.user_id,
  r.organization_id,
  null::uuid,
  'resident_invalid_hostel_id'::text,
  'resident.hostel_id references an existing hostel in the same organization'::text,
  'resident.hostel_id is missing or does not reference an existing hostel'::text,
  'review_manually'::text,
  'Choose the correct hostel from admission history before activating onboarding, occupancy, or billing.'::text
from public.residents r
left join public.hostels h on h.id = r.hostel_id
where r.deleted_at is null
  and r.organization_id is not null
  and h.id is null
union all
select
  'residents'::text,
  r.id,
  r.id,
  r.organization_id,
  r.hostel_id,
  r.user_id,
  h.organization_id,
  h.id,
  'resident_hostel_organization_mismatch'::text,
  'resident organization matches linked hostel organization'::text,
  'resident.organization_id differs from hostel.organization_id'::text,
  'review_manually'::text,
  'Move the resident to the correct hostel or archive the stale resident before occupancy repair.'::text
from public.residents r
join public.hostels h on h.id = r.hostel_id
where r.deleted_at is null
  and r.organization_id is distinct from h.organization_id
union all
select
  'residents'::text,
  r.id,
  r.id,
  r.organization_id,
  r.hostel_id,
  r.user_id,
  r.organization_id,
  r.hostel_id,
  'resident_auth_profile_missing'::text,
  'resident.user_id points to an existing public.users profile'::text,
  'resident.user_id is set but public.users profile is missing'::text,
  'review_manually'::text,
  'Use resident lifecycle repair only after confirming the Supabase auth user exists and belongs to this resident.'::text
from public.residents r
left join public.users u on u.id = r.user_id
where r.deleted_at is null
  and r.user_id is not null
  and u.id is null
union all
select
  'residents'::text,
  r.id,
  r.id,
  r.organization_id,
  r.hostel_id,
  r.user_id,
  u.organization_id,
  r.hostel_id,
  'resident_auth_profile_organization_mismatch'::text,
  'resident organization matches linked auth profile organization'::text,
  'resident.organization_id differs from linked public.users.organization_id'::text,
  'review_manually'::text,
  'Do not auto-relink auth ownership. Review activation logs and rebuild the linkage from the admin repair center.'::text
from public.residents r
join public.users u on u.id = r.user_id
where r.deleted_at is null
  and r.organization_id is distinct from u.organization_id;

create or replace function public.get_resident_tenant_identity_anomaly_report(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_limit integer default 100
)
returns table (
  table_name text,
  record_id uuid,
  resident_id uuid,
  organization_id uuid,
  hostel_id uuid,
  user_id uuid,
  expected_organization_id uuid,
  expected_hostel_id uuid,
  anomaly_type text,
  expected_state text,
  actual_state text,
  recommended_repair_action text,
  recommendation text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_organization_id is null then
    raise exception 'tenant_anomaly_report_requires_organization' using errcode = '22023';
  end if;

  if not (
    public.is_service_context()
    or public.can_manage_organization(p_organization_id, p_hostel_id)
  ) then
    raise exception 'tenant_anomaly_report_forbidden' using errcode = '42501';
  end if;

  return query
  select
    a.table_name,
    a.record_id,
    a.resident_id,
    a.organization_id,
    a.hostel_id,
    a.user_id,
    a.expected_organization_id,
    a.expected_hostel_id,
    a.anomaly_type,
    a.expected_state,
    a.actual_state,
    a.recommended_repair_action,
    a.recommendation
  from public.resident_tenant_identity_anomalies a
  where (
      a.organization_id = p_organization_id
      or a.expected_organization_id = p_organization_id
      or public.is_service_context()
    )
    and (
      p_hostel_id is null
      or a.hostel_id = p_hostel_id
      or a.expected_hostel_id = p_hostel_id
    )
  order by
    case
      when a.anomaly_type = 'resident_missing_organization_id' then 1
      when a.anomaly_type = 'resident_invalid_organization_id' then 2
      when a.anomaly_type = 'resident_invalid_hostel_id' then 3
      else 4
    end,
    a.record_id
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.get_resident_tenant_identity_anomaly_report(uuid, uuid, integer)
from public, anon;
grant execute on function public.get_resident_tenant_identity_anomaly_report(uuid, uuid, integer)
to authenticated, service_role;

drop trigger if exists normalize_resident_phone_columns on public.residents;
create trigger normalize_resident_phone_columns
before insert or update of phone, parent_phone, emergency_contact_phone on public.residents
for each row
execute function public.normalize_resident_phone_columns();

drop trigger if exists normalize_user_phone_columns on public.users;
create trigger normalize_user_phone_columns
before insert or update of phone on public.users
for each row
execute function public.normalize_user_phone_columns();

drop trigger if exists normalize_resident_invite_phone_columns on public.resident_invites;
create trigger normalize_resident_invite_phone_columns
before insert or update of phone on public.resident_invites
for each row
execute function public.normalize_resident_invite_phone_columns();

drop trigger if exists normalize_lead_phone_columns on public.leads;
create trigger normalize_lead_phone_columns
before insert or update of phone, whatsapp_number, parent_phone on public.leads
for each row
execute function public.normalize_lead_phone_columns();

comment on function public.normalize_indian_phone(text) is
  'Canonicalizes Indian mobile phone identities into strict E.164 format for auth, invites, residents, and WhatsApp.';

comment on view public.phone_identity_normalization_anomalies is
  'Tenant-scoped diagnostics for invalid or non-canonical phone identity records that need admin repair.';

comment on view public.resident_tenant_identity_anomalies is
  'Sanitized resident tenant/auth linkage anomaly report. Historical orphan rows are never auto-assigned to a tenant.';

comment on function public.get_resident_tenant_identity_anomaly_report(uuid, uuid, integer) is
  'Returns sanitized tenant/auth resident anomaly diagnostics for Admin -> Operations -> Tenant Consistency Repair.';
