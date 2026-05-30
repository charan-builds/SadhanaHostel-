-- Add resident-scoped private realtime channels and narrow hostel/global
-- broadcast topics to staff roles. Resident clients should subscribe to:
-- tenant:{organizationId}:hostel:{hostelId}:resident:{residentId}

create or replace function public.realtime_topic_organization_id(topic text)
returns uuid
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when topic ~* '^tenant:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(global|hostel:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:resident:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)$'
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
    when topic ~* '^tenant:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:hostel:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:resident:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$'
      then split_part(topic, ':', 4)::uuid
    else null::uuid
  end;
$$;

create or replace function public.realtime_topic_resident_id(topic text)
returns uuid
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when topic ~* '^tenant:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:hostel:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:resident:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(topic, ':', 6)::uuid
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
  and public.realtime_topic_organization_id((select realtime.topic())) is not null
  and (
    public.is_super_admin()
    or (
      public.realtime_topic_resident_id((select realtime.topic())) is null
      and public.has_role_in_organization(
        public.realtime_topic_organization_id((select realtime.topic())),
        array[
          'owner',
          'admin',
          'finance',
          'receptionist',
          'warden',
          'staff'
        ]::public.user_role_enum[],
        public.realtime_topic_hostel_id((select realtime.topic()))
      )
    )
    or (
      public.realtime_topic_resident_id((select realtime.topic())) is not null
      and exists (
        select 1
        from public.residents r
        where r.user_id = (select auth.uid())
          and r.organization_id = public.realtime_topic_organization_id((select realtime.topic()))
          and r.hostel_id = public.realtime_topic_hostel_id((select realtime.topic()))
          and r.id = public.realtime_topic_resident_id((select realtime.topic()))
          and r.is_active is true
          and r.deleted_at is null
      )
    )
  )
);

comment on policy "tenant_private_broadcast_read" on realtime.messages is
  'Allows staff to receive tenant/hostel broadcasts and residents to receive only their own resident-scoped broadcasts.';
