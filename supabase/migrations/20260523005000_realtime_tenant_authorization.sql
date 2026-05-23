-- Tenant-scoped authorization for Supabase Realtime private channels.
-- Clients subscribe with config.private=true. Supabase evaluates SELECT
-- policies on realtime.messages when joining a private broadcast topic.

create or replace function public.realtime_topic_organization_id(topic text)
returns uuid
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when topic ~* '^tenant:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(global|hostel:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
      then split_part(topic, ':', 2)::uuid
    else null::uuid
  end;
$$;

create or replace function public.realtime_topic_hostel_id(topic text)
returns uuid
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when topic ~* '^tenant:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:hostel:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(topic, ':', 4)::uuid
    else null::uuid
  end;
$$;

drop policy if exists "tenant_private_broadcast_read" on realtime.messages;
create policy "tenant_private_broadcast_read"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.belongs_to_organization(
    public.realtime_topic_organization_id((select realtime.topic()))
  )
  and (
    public.realtime_topic_hostel_id((select realtime.topic())) is null
    or public.is_super_admin()
    or public.has_role_in_organization(
      public.realtime_topic_organization_id((select realtime.topic())),
      array[
        'owner',
        'admin',
        'finance',
        'receptionist',
        'warden',
        'staff',
        'resident',
        'parent'
      ]::public.user_role_enum[],
      public.realtime_topic_hostel_id((select realtime.topic()))
    )
    or exists (
      select 1
      from public.residents r
      where r.user_id = (select auth.uid())
        and r.organization_id = public.realtime_topic_organization_id((select realtime.topic()))
        and r.hostel_id = public.realtime_topic_hostel_id((select realtime.topic()))
        and r.is_active is true
        and r.deleted_at is null
    )
  )
);

comment on policy "tenant_private_broadcast_read" on realtime.messages is
  'Allows authenticated users to receive private broadcast events only for tenant topics matching their organization and hostel scope.';
