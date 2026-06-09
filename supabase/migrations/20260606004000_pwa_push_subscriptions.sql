begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  platform text,
  device_label text,
  last_seen_at timestamptz not null default now(),
  last_sent_at timestamptz,
  failure_count integer not null default 0,
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  constraint push_subscriptions_endpoint_chk check (endpoint ~ '^https://'),
  constraint push_subscriptions_failure_count_chk check (failure_count >= 0),
  unique (endpoint)
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(organization_id, user_id, resident_id)
  where revoked_at is null;

create index if not exists push_subscriptions_resident_active_idx
  on public.push_subscriptions(organization_id, resident_id)
  where revoked_at is null;

create index if not exists push_subscriptions_hostel_active_idx
  on public.push_subscriptions(organization_id, hostel_id)
  where revoked_at is null;

drop trigger if exists set_push_subscriptions_updated_at
  on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists "push_subscriptions_select_owner_admin_or_self"
  on public.push_subscriptions;
create policy "push_subscriptions_select_owner_admin_or_self"
on public.push_subscriptions
for select
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or auth.uid() = user_id
);

drop policy if exists "push_subscriptions_insert_self"
  on public.push_subscriptions;
create policy "push_subscriptions_insert_self"
on public.push_subscriptions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.belongs_to_organization(organization_id)
);

drop policy if exists "push_subscriptions_update_owner_admin_or_self"
  on public.push_subscriptions;
create policy "push_subscriptions_update_owner_admin_or_self"
on public.push_subscriptions
for update
to authenticated
using (
  public.can_manage_organization(organization_id, hostel_id)
  or auth.uid() = user_id
)
with check (
  public.can_manage_organization(organization_id, hostel_id)
  or auth.uid() = user_id
);

comment on table public.push_subscriptions is
  'Tenant-scoped Web Push subscriptions for installable resident PWA notifications.';

comment on column public.push_subscriptions.endpoint is
  'Browser Push API endpoint. Treat as a delivery credential and protect with RLS.';

commit;
