-- Employee accommodation room metadata for public CMS gallery sections.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.employee_accommodation_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  title text not null,
  description text,
  capacity integer not null default 1 check (capacity > 0 and capacity <= 50),
  amenities text[] not null default array[]::text[],
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  status public.cms_status_enum not null default 'draft',
  published_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

comment on table public.employee_accommodation_rooms is
  'CMS-managed employee accommodation room metadata. Room images are stored as gallery rows with employee-room:<room_id> categories.';

create index if not exists employee_accommodation_rooms_organization_id_idx
  on public.employee_accommodation_rooms (organization_id);

create index if not exists employee_accommodation_rooms_hostel_status_idx
  on public.employee_accommodation_rooms (hostel_id, status, is_visible, sort_order);

create index if not exists employee_accommodation_rooms_created_at_idx
  on public.employee_accommodation_rooms (created_at desc);

drop trigger if exists employee_accommodation_rooms_touch_updated_at
  on public.employee_accommodation_rooms;
drop trigger if exists set_employee_accommodation_rooms_updated_at
  on public.employee_accommodation_rooms;
create trigger set_employee_accommodation_rooms_updated_at
before update on public.employee_accommodation_rooms
for each row
execute function public.set_updated_at();

alter table public.employee_accommodation_rooms enable row level security;
alter table public.employee_accommodation_rooms force row level security;

drop policy if exists "employee_accommodation_rooms_public_published_select"
  on public.employee_accommodation_rooms;
create policy "employee_accommodation_rooms_public_published_select"
on public.employee_accommodation_rooms
for select
to anon
using (
  status = 'published'
  and is_visible = true
  and is_active = true
  and deleted_at is null
);

drop policy if exists "employee_accommodation_rooms_authenticated_select"
  on public.employee_accommodation_rooms;
create policy "employee_accommodation_rooms_authenticated_select"
on public.employee_accommodation_rooms
for select
to authenticated
using (
  (
    status = 'published'
    and is_visible = true
    and is_active = true
    and deleted_at is null
  )
  or public.can_manage_organization(organization_id, hostel_id)
);

drop policy if exists "employee_accommodation_rooms_insert_admin"
  on public.employee_accommodation_rooms;
create policy "employee_accommodation_rooms_insert_admin"
on public.employee_accommodation_rooms
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "employee_accommodation_rooms_update_admin"
  on public.employee_accommodation_rooms;
create policy "employee_accommodation_rooms_update_admin"
on public.employee_accommodation_rooms
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));
