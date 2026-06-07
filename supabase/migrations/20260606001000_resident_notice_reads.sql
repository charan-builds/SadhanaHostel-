begin;

create table if not exists public.notice_reads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  notice_id uuid not null references public.notices(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  unique (notice_id, resident_id)
);

create index if not exists notice_reads_org_idx
  on public.notice_reads(organization_id, hostel_id);

create index if not exists notice_reads_notice_idx
  on public.notice_reads(notice_id);

create index if not exists notice_reads_resident_idx
  on public.notice_reads(resident_id, read_at desc);

drop trigger if exists set_notice_reads_updated_at on public.notice_reads;
create trigger set_notice_reads_updated_at
before update on public.notice_reads
for each row execute function public.set_updated_at();

alter table public.notice_reads enable row level security;
alter table public.notice_reads force row level security;

drop policy if exists "notice_reads_select_owner_or_admin_or_resident" on public.notice_reads;
create policy "notice_reads_select_owner_or_admin_or_resident"
on public.notice_reads
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "notice_reads_insert_owner_or_admin_or_resident" on public.notice_reads;
create policy "notice_reads_insert_owner_or_admin_or_resident"
on public.notice_reads
for insert
to authenticated
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "notice_reads_update_owner_or_admin_or_resident" on public.notice_reads;
create policy "notice_reads_update_owner_or_admin_or_resident"
on public.notice_reads
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

comment on table public.notice_reads is
  'Per-resident notice acknowledgement tracking for resident popups, notice center state, and owner read-rate analytics.';

commit;
