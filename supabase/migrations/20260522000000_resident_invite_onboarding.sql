-- Resident invite-only onboarding.
-- Replaces open resident signup with admin-controlled activation links/codes.

begin;

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.resident_invite_status_enum as enum (
    'pending',
    'used',
    'expired',
    'revoked'
  );
exception
  when duplicate_object then null;
end $$;

alter type public.admission_activity_type_enum add value if not exists 'resident_invite_created';
alter type public.admission_activity_type_enum add value if not exists 'resident_invite_resent';
alter type public.admission_activity_type_enum add value if not exists 'resident_invite_revoked';
alter type public.admission_activity_type_enum add value if not exists 'resident_invite_used';
alter type public.lead_status_enum add value if not exists 'waitlisted';

-- ---------------------------------------------------------------------------
-- Resident invites
-- ---------------------------------------------------------------------------

create table if not exists public.resident_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  email citext,
  phone text,
  invite_code text not null,
  invite_token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid references public.users(id) on delete set null,
  status public.resident_invite_status_enum not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint resident_invites_contact_required_chk check (
    email is not null or phone is not null
  ),
  constraint resident_invites_token_hash_chk check (length(invite_token_hash) >= 64),
  constraint resident_invites_code_chk check (invite_code ~ '^SBH-[A-Z0-9]{6,12}$'),
  constraint resident_invites_status_timestamps_chk check (
    (status = 'pending' and used_at is null and revoked_at is null)
    or (status = 'used' and used_at is not null)
    or (status = 'revoked' and revoked_at is not null)
    or status = 'expired'
  )
);

comment on table public.resident_invites is
  'Admin-controlled one-time resident activation invites. Raw activation tokens are never stored.';

create unique index if not exists resident_invites_token_hash_uidx
  on public.resident_invites (invite_token_hash);

create unique index if not exists resident_invites_code_uidx
  on public.resident_invites (invite_code);

create unique index if not exists resident_invites_one_pending_per_resident_uidx
  on public.resident_invites (organization_id, resident_id)
  where status = 'pending'
    and used_at is null
    and revoked_at is null;

create index if not exists resident_invites_org_status_expiry_idx
  on public.resident_invites (organization_id, hostel_id, status, expires_at);

create index if not exists resident_invites_resident_created_idx
  on public.resident_invites (resident_id, created_at desc);

create index if not exists resident_invites_email_idx
  on public.resident_invites (organization_id, email)
  where email is not null;

create index if not exists resident_invites_phone_idx
  on public.resident_invites (organization_id, phone)
  where phone is not null;

drop trigger if exists set_resident_invites_updated_at on public.resident_invites;
create trigger set_resident_invites_updated_at
before update on public.resident_invites
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Expiration helper
-- ---------------------------------------------------------------------------

create or replace function public.expire_resident_invites(
  p_organization_id uuid default null,
  p_hostel_id uuid default null,
  p_limit integer default 500
)
returns table (
  expired_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  with candidates as (
    select i.id
    from public.resident_invites i
    where i.status = 'pending'
      and i.expires_at <= now()
      and i.used_at is null
      and i.revoked_at is null
      and (p_organization_id is null or i.organization_id = p_organization_id)
      and (p_hostel_id is null or i.hostel_id = p_hostel_id)
    order by i.expires_at asc
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  ),
  expired as (
    update public.resident_invites i
    set
      status = 'expired',
      updated_at = now()
    from candidates c
    where i.id = c.id
    returning i.*
  )
  select count(*)::integer into v_count from expired;

  return query select coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.resident_invites enable row level security;

drop policy if exists "resident_invites_admin_select" on public.resident_invites;
create policy "resident_invites_admin_select"
on public.resident_invites
for select
to authenticated
using (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "resident_invites_admin_insert" on public.resident_invites;
create policy "resident_invites_admin_insert"
on public.resident_invites
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "resident_invites_admin_update" on public.resident_invites;
create policy "resident_invites_admin_update"
on public.resident_invites
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "resident_invites_no_delete" on public.resident_invites;
create policy "resident_invites_no_delete"
on public.resident_invites
for delete
to authenticated
using (false);

-- Public activation never reads this table directly. It goes through service-role
-- route handlers that verify signed tokens, one-time status, and expiration.
revoke all on public.resident_invites from anon;
grant select, insert, update on public.resident_invites to authenticated, service_role;
grant execute on function public.expire_resident_invites(uuid, uuid, integer) to authenticated, service_role;

commit;
