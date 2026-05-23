-- Operations automation control plane.
-- This table lets hostel admins disable risky jobs per tenant and store desired schedules
-- without touching Supabase manually. Vercel cron remains the external trigger, but
-- job execution checks this table before running tenant work.

create table if not exists public.automation_job_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete cascade,
  job_name text not null,
  enabled boolean not null default true,
  cron_schedule text not null default 'manual',
  dry_run_only boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  constraint automation_job_settings_job_name_chk check (length(job_name) between 3 and 120)
);

create unique index if not exists automation_job_settings_unique_idx
  on public.automation_job_settings (
    organization_id,
    coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    job_name
  );

create index if not exists automation_job_settings_org_idx
  on public.automation_job_settings (organization_id, enabled);

create index if not exists automation_job_settings_hostel_idx
  on public.automation_job_settings (hostel_id, enabled);

drop trigger if exists set_automation_job_settings_updated_at on public.automation_job_settings;
create trigger set_automation_job_settings_updated_at
before update on public.automation_job_settings
for each row execute function public.set_updated_at();

alter table public.automation_job_settings enable row level security;
alter table public.automation_job_settings force row level security;

drop policy if exists "automation_job_settings_select_admin" on public.automation_job_settings;
create policy "automation_job_settings_select_admin"
on public.automation_job_settings
for select
to authenticated
using (public.can_manage_organization(organization_id));

drop policy if exists "automation_job_settings_write_admin" on public.automation_job_settings;
create policy "automation_job_settings_write_admin"
on public.automation_job_settings
for all
to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));
