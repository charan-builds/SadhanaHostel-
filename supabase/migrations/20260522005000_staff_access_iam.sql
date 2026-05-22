-- Staff access and IAM hardening for admin-controlled hostel operations.

alter type public.user_role_enum add value if not exists 'finance';
alter type public.user_role_enum add value if not exists 'receptionist';
alter type public.user_role_enum add value if not exists 'warden';

alter table public.user_roles
  drop constraint if exists user_roles_status_chk,
  add constraint user_roles_status_chk check (
    status in ('invited', 'active', 'suspended', 'locked', 'deleted')
  );

create index if not exists user_roles_staff_access_idx
  on public.user_roles (organization_id, role, status, created_at desc)
  where deleted_at is null;

create index if not exists user_roles_hostel_status_idx
  on public.user_roles (organization_id, hostel_id, status)
  where deleted_at is null;

create index if not exists users_account_status_idx
  on public.users ((metadata->>'account_status'), organization_id)
  where deleted_at is null;

comment on constraint user_roles_status_chk on public.user_roles is
  'Operational account state used by admin Staff & Access. Auth sessions are rejected for suspended, locked, and deleted app profiles.';
