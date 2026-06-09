begin;

alter table public.notices
  add column if not exists notice_type text not null default 'general'
    check (notice_type in ('general', 'fee_updates', 'hostel_rules', 'maintenance', 'emergency')),
  add column if not exists requires_acknowledgement boolean not null default false;

create index if not exists notices_type_status_idx
  on public.notices (organization_id, hostel_id, notice_type, status, published_at desc)
  where deleted_at is null;

create table if not exists public.notice_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  notice_id uuid not null references public.notices(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  unique (notice_id, resident_id)
);

create index if not exists notice_acknowledgements_org_idx
  on public.notice_acknowledgements(organization_id, hostel_id);

create index if not exists notice_acknowledgements_notice_idx
  on public.notice_acknowledgements(notice_id);

create index if not exists notice_acknowledgements_resident_idx
  on public.notice_acknowledgements(resident_id, acknowledged_at desc);

drop trigger if exists set_notice_acknowledgements_updated_at
  on public.notice_acknowledgements;
create trigger set_notice_acknowledgements_updated_at
before update on public.notice_acknowledgements
for each row execute function public.set_updated_at();

alter table public.notice_acknowledgements enable row level security;
alter table public.notice_acknowledgements force row level security;

drop policy if exists "notice_acknowledgements_select_owner_or_admin_or_resident"
  on public.notice_acknowledgements;
create policy "notice_acknowledgements_select_owner_or_admin_or_resident"
on public.notice_acknowledgements
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "notice_acknowledgements_insert_owner_or_admin_or_resident"
  on public.notice_acknowledgements;
create policy "notice_acknowledgements_insert_owner_or_admin_or_resident"
on public.notice_acknowledgements
for insert
to authenticated
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "notice_acknowledgements_update_owner_or_admin_or_resident"
  on public.notice_acknowledgements;
create policy "notice_acknowledgements_update_owner_or_admin_or_resident"
on public.notice_acknowledgements
for update
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
)
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

comment on column public.notices.notice_type is
  'Resident notice classification: general, fee_updates, hostel_rules, maintenance, or emergency.';

comment on column public.notices.requires_acknowledgement is
  'When true, the resident portal requires an explicit acknowledgement after reading.';

comment on table public.notice_acknowledgements is
  'Per-resident acknowledgement records for important resident notices.';

commit;
