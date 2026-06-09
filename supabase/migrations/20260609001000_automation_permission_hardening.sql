-- Give owner/admin operators an explicit automation capability and keep
-- automation settings inaccessible to non-administrative tenant roles.

begin;

create or replace function public.role_has_permission(
  p_role public.user_role_enum,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_role
    when 'super_admin' then p_permission = any(array[
      'admin.dashboard.view',
      'admissions.manage',
      'analytics.view',
      'automation.manage',
      'cms.manage',
      'finance.manage',
      'iam.manage',
      'leaves.manage',
      'notices.manage',
      'payments.verify',
      'reports.export',
      'residents.manage',
      'rooms.manage',
      'settings.manage'
    ])
    when 'owner' then p_permission = any(array[
      'admin.dashboard.view',
      'admissions.manage',
      'analytics.view',
      'automation.manage',
      'cms.manage',
      'finance.manage',
      'iam.manage',
      'leaves.manage',
      'notices.manage',
      'payments.verify',
      'reports.export',
      'residents.manage',
      'rooms.manage',
      'settings.manage'
    ])
    when 'admin' then p_permission = any(array[
      'admin.dashboard.view',
      'admissions.manage',
      'analytics.view',
      'automation.manage',
      'cms.manage',
      'finance.manage',
      'iam.manage',
      'leaves.manage',
      'notices.manage',
      'payments.verify',
      'reports.export',
      'residents.manage',
      'rooms.manage',
      'settings.manage'
    ])
    when 'finance' then p_permission = any(array[
      'admin.dashboard.view',
      'analytics.view',
      'finance.manage',
      'payments.verify',
      'reports.export'
    ])
    when 'receptionist' then p_permission = any(array[
      'admin.dashboard.view',
      'admissions.manage',
      'notices.manage',
      'residents.manage'
    ])
    when 'warden' then p_permission = any(array[
      'admin.dashboard.view',
      'leaves.manage',
      'notices.manage',
      'residents.manage',
      'rooms.manage'
    ])
    when 'staff' then p_permission = any(array[
      'admin.dashboard.view',
      'notices.manage',
      'residents.manage'
    ])
    else false
  end;
$$;

drop policy if exists "automation_job_settings_select_admin"
  on public.automation_job_settings;
create policy "automation_job_settings_select_admin"
on public.automation_job_settings
for select
to authenticated
using (
  public.has_permission_in_organization(
    organization_id,
    'automation.manage',
    hostel_id
  )
);

drop policy if exists "automation_job_settings_write_admin"
  on public.automation_job_settings;
create policy "automation_job_settings_write_admin"
on public.automation_job_settings
for all
to authenticated
using (
  public.has_permission_in_organization(
    organization_id,
    'automation.manage',
    hostel_id
  )
)
with check (
  public.has_permission_in_organization(
    organization_id,
    'automation.manage',
    hostel_id
  )
);

commit;
