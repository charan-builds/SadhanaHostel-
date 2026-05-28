-- Defense-in-depth for staging resets and auth cleanup.
-- Admin/owner/staff profiles should never be hard-deleted by operational data
-- resets. Business deactivation must use staff access suspension/soft-delete
-- workflows instead.

begin;

create or replace function public.prevent_privileged_user_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_platform_user is true
     or old.default_role::text not in ('resident', 'parent')
     or exists (
       select 1
       from public.user_roles ur
       where ur.user_id = old.id
         and ur.role::text not in ('resident', 'parent')
         and ur.deleted_at is null
     ) then
    raise exception 'privileged_user_hard_delete_blocked';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_privileged_user_hard_delete on public.users;
create trigger prevent_privileged_user_hard_delete
before delete on public.users
for each row
execute function public.prevent_privileged_user_hard_delete();

comment on function public.prevent_privileged_user_hard_delete() is
  'Blocks hard deletion of owner/admin/staff/platform profiles, including accidental staging reset candidates. Resident/test users may still be deleted by service-role reset workflows.';

commit;
