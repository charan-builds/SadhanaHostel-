-- Hostel Rules Management.
-- Tenant-scoped rule catalog plus per-resident rules acceptance records.

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.hostel_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete cascade,
  category text not null,
  title text not null,
  description text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint hostel_rules_category_chk check (
    category in (
      'General',
      'Payments',
      'Discipline',
      'Visitors',
      'Leave Policy',
      'Safety',
      'Employee Accommodation',
      'Custom'
    )
  ),
  constraint hostel_rules_display_order_chk check (display_order >= 0),
  constraint hostel_rules_title_chk check (char_length(btrim(title)) >= 2),
  constraint hostel_rules_description_chk check (char_length(btrim(description)) >= 5)
);

comment on table public.hostel_rules is
  'Tenant-scoped hostel rules and policies managed from Admin Settings.';

create index if not exists hostel_rules_organization_id_idx
  on public.hostel_rules (organization_id);

create index if not exists hostel_rules_hostel_category_order_idx
  on public.hostel_rules (hostel_id, category, display_order)
  where deleted_at is null;

create index if not exists hostel_rules_active_order_idx
  on public.hostel_rules (organization_id, hostel_id, is_active, display_order)
  where deleted_at is null;

create index if not exists hostel_rules_updated_at_idx
  on public.hostel_rules (updated_at desc);

create table if not exists public.hostel_rule_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  resident_id uuid not null references public.residents(id) on delete cascade,
  rules_version text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint hostel_rule_acceptances_version_chk check (char_length(btrim(rules_version)) >= 8),
  unique (resident_id, rules_version)
);

comment on table public.hostel_rule_acceptances is
  'Per-resident acceptance records for the current hostel rules version.';

create index if not exists hostel_rule_acceptances_org_hostel_idx
  on public.hostel_rule_acceptances (organization_id, hostel_id, accepted_at desc);

create index if not exists hostel_rule_acceptances_resident_idx
  on public.hostel_rule_acceptances (resident_id, accepted_at desc);

create index if not exists hostel_rule_acceptances_version_idx
  on public.hostel_rule_acceptances (organization_id, hostel_id, rules_version);

drop trigger if exists set_hostel_rules_updated_at on public.hostel_rules;
create trigger set_hostel_rules_updated_at
before update on public.hostel_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_hostel_rule_acceptances_updated_at
  on public.hostel_rule_acceptances;
create trigger set_hostel_rule_acceptances_updated_at
before update on public.hostel_rule_acceptances
for each row execute function public.set_updated_at();

alter table public.hostel_rules enable row level security;
alter table public.hostel_rules force row level security;

alter table public.hostel_rule_acceptances enable row level security;
alter table public.hostel_rule_acceptances force row level security;

drop policy if exists "hostel_rules_public_active_select" on public.hostel_rules;
create policy "hostel_rules_public_active_select"
on public.hostel_rules
for select
to anon
using (
  is_active = true
  and deleted_at is null
);

drop policy if exists "hostel_rules_authenticated_select" on public.hostel_rules;
create policy "hostel_rules_authenticated_select"
on public.hostel_rules
for select
to authenticated
using (
  (
    is_active = true
    and deleted_at is null
  )
  or public.has_permission_in_organization(organization_id, 'settings.manage', hostel_id)
);

drop policy if exists "hostel_rules_insert_settings_admin" on public.hostel_rules;
create policy "hostel_rules_insert_settings_admin"
on public.hostel_rules
for insert
to authenticated
with check (
  public.has_permission_in_organization(organization_id, 'settings.manage', hostel_id)
);

drop policy if exists "hostel_rules_update_settings_admin" on public.hostel_rules;
create policy "hostel_rules_update_settings_admin"
on public.hostel_rules
for update
to authenticated
using (
  public.has_permission_in_organization(organization_id, 'settings.manage', hostel_id)
)
with check (
  public.has_permission_in_organization(organization_id, 'settings.manage', hostel_id)
);

drop policy if exists "hostel_rule_acceptances_select_admin_or_resident"
  on public.hostel_rule_acceptances;
create policy "hostel_rule_acceptances_select_admin_or_resident"
on public.hostel_rule_acceptances
for select
to authenticated
using (
  public.has_permission_in_organization(organization_id, 'settings.manage', hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "hostel_rule_acceptances_insert_admin_or_resident"
  on public.hostel_rule_acceptances;
create policy "hostel_rule_acceptances_insert_admin_or_resident"
on public.hostel_rule_acceptances
for insert
to authenticated
with check (
  public.has_permission_in_organization(organization_id, 'settings.manage', hostel_id)
  or public.owns_resident(resident_id)
);

drop policy if exists "hostel_rule_acceptances_update_admin_or_resident"
  on public.hostel_rule_acceptances;
create policy "hostel_rule_acceptances_update_admin_or_resident"
on public.hostel_rule_acceptances
for update
to authenticated
using (
  public.has_permission_in_organization(organization_id, 'settings.manage', hostel_id)
  or public.owns_resident(resident_id)
)
with check (
  public.has_permission_in_organization(organization_id, 'settings.manage', hostel_id)
  or public.owns_resident(resident_id)
);

insert into public.hostel_rules (
  organization_id,
  hostel_id,
  category,
  title,
  description,
  display_order,
  is_active
)
select
  h.organization_id,
  h.id,
  seed.category,
  seed.title,
  seed.description,
  seed.display_order,
  true
from public.hostels h
cross join (
  values
    ('Discipline', 'No alcohol', 'Alcohol is not allowed inside the hostel premises.', 10),
    ('Discipline', 'No smoking', 'Smoking is not allowed inside rooms, common areas, or hostel surroundings.', 20),
    ('Discipline', 'No drugs', 'Illegal drugs and substance abuse are strictly prohibited.', 30),
    ('Discipline', 'No gambling', 'Gambling and betting activities are not allowed in the hostel.', 40),
    ('General', 'Property damage recovery', 'Residents must pay for hostel property damage caused by them or their guests.', 50),
    ('General', 'Follow management instructions', 'Residents must follow reasonable instructions from hostel management and wardens.', 60),
    ('Visitors', 'Visitor restrictions', 'Visitors are allowed only as per management-approved timings and areas.', 70),
    ('Payments', 'Payment rules', 'Monthly fees and dues must be paid on time as communicated by hostel management.', 80),
    ('Leave Policy', 'Leave rules', 'Residents must follow hostel leave request and return procedures.', 90),
    ('Employee Accommodation', 'Employee room cleanliness', 'Employee accommodation residents must maintain cleanliness and respect hostel timings.', 100)
) as seed(category, title, description, display_order)
where h.deleted_at is null
  and h.is_active is true
  and not exists (
    select 1
    from public.hostel_rules r
    where r.organization_id = h.organization_id
      and r.hostel_id = h.id
      and r.title = seed.title
      and r.deleted_at is null
  );

commit;
