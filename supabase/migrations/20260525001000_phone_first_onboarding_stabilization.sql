-- Phone-first resident onboarding stabilization.
-- Keeps auth.users, public.users, residents, and resident_invites aligned for
-- activation links, temporary passwords, and stale invite cleanup.

begin;

create or replace function public.sync_resident_invite_activation_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resident public.residents%rowtype;
  v_access_mode text;
begin
  if new.status <> 'used'
     or new.used_at is null
     or old.status = 'used' then
    return new;
  end if;

  select *
  into v_resident
  from public.residents
  where id = new.resident_id
    and organization_id = new.organization_id
    and hostel_id = new.hostel_id
    and deleted_at is null;

  if not found or v_resident.user_id is null then
    return new;
  end if;

  v_access_mode := coalesce(nullif(new.metadata ->> 'access_mode', ''), 'activation_link');

  update public.users
  set
    organization_id = v_resident.organization_id,
    default_role = 'resident',
    is_active = true,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_strip_nulls(
        jsonb_build_object(
          'resident_id', v_resident.id,
          'resident_access_mode', v_access_mode,
          'temporary_password_active', v_access_mode = 'temporary_password',
          'temporary_password_expires_at',
            case
              when v_access_mode = 'temporary_password'
              then new.metadata ->> 'temporary_password_expires_at'
              else null
            end,
          'last_resident_activation_at', new.used_at,
          'last_resident_invite_id', new.id
        )
      ),
    updated_at = now(),
    updated_by = v_resident.user_id
  where id = v_resident.user_id
    and deleted_at is null;

  return new;
end;
$$;

drop trigger if exists sync_resident_invite_activation_metadata
  on public.resident_invites;
create trigger sync_resident_invite_activation_metadata
after update of status, used_at on public.resident_invites
for each row
execute function public.sync_resident_invite_activation_metadata();

create or replace function public.cleanup_resident_onboarding_access(
  p_organization_id uuid default null,
  p_hostel_id uuid default null,
  p_limit integer default 500,
  p_actor_user_id uuid default auth.uid()
)
returns table (
  expired_count integer,
  activated_invites_revoked_count integer,
  duplicate_invites_revoked_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expired_count integer := 0;
  v_activated_revoked_count integer := 0;
  v_duplicate_revoked_count integer := 0;
begin
  if p_organization_id is not null
     and not (public.is_service_context() or public.can_manage_organization(p_organization_id, p_hostel_id)) then
    raise exception 'resident_invite_cleanup_forbidden' using errcode = '42501';
  end if;

  with expired_candidates as (
    select i.id
    from public.resident_invites i
    where i.status = 'pending'
      and i.used_at is null
      and i.revoked_at is null
      and i.expires_at <= now()
      and (p_organization_id is null or i.organization_id = p_organization_id)
      and (p_hostel_id is null or i.hostel_id = p_hostel_id)
    order by i.expires_at asc
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  ),
  expired as (
    update public.resident_invites i
    set
      status = 'expired',
      updated_at = now(),
      updated_by = p_actor_user_id
    from expired_candidates c
    where i.id = c.id
    returning i.id
  )
  select count(*)::integer into v_expired_count from expired;

  with activated_candidates as (
    select i.id
    from public.resident_invites i
    join public.residents r
      on r.id = i.resident_id
     and r.organization_id = i.organization_id
     and r.hostel_id = i.hostel_id
    where i.status = 'pending'
      and i.used_at is null
      and i.revoked_at is null
      and r.user_id is not null
      and r.deleted_at is null
      and (p_organization_id is null or i.organization_id = p_organization_id)
      and (p_hostel_id is null or i.hostel_id = p_hostel_id)
    order by i.created_at asc
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  ),
  activated_revoked as (
    update public.resident_invites i
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now(),
      updated_by = p_actor_user_id,
      metadata = coalesce(i.metadata, '{}'::jsonb)
        || jsonb_build_object('cleanup_reason', 'resident_already_activated')
    from activated_candidates c
    where i.id = c.id
    returning i.id
  )
  select count(*)::integer into v_activated_revoked_count from activated_revoked;

  with ranked_active as (
    select
      i.id,
      row_number() over (
        partition by i.organization_id, i.resident_id
        order by i.created_at desc, i.id desc
      ) as active_rank
    from public.resident_invites i
    where i.status = 'pending'
      and i.used_at is null
      and i.revoked_at is null
      and i.expires_at > now()
      and (p_organization_id is null or i.organization_id = p_organization_id)
      and (p_hostel_id is null or i.hostel_id = p_hostel_id)
  ),
  duplicate_candidates as (
    select id
    from ranked_active
    where active_rank > 1
    limit greatest(coalesce(p_limit, 500), 1)
  ),
  duplicate_revoked as (
    update public.resident_invites i
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now(),
      updated_by = p_actor_user_id,
      metadata = coalesce(i.metadata, '{}'::jsonb)
        || jsonb_build_object('cleanup_reason', 'duplicate_active_invite')
    from duplicate_candidates c
    where i.id = c.id
    returning i.id
  )
  select count(*)::integer into v_duplicate_revoked_count from duplicate_revoked;

  return query select
    coalesce(v_expired_count, 0),
    coalesce(v_activated_revoked_count, 0),
    coalesce(v_duplicate_revoked_count, 0);
end;
$$;

grant execute on function public.cleanup_resident_onboarding_access(uuid, uuid, integer, uuid)
  to authenticated, service_role;

comment on function public.cleanup_resident_onboarding_access(uuid, uuid, integer, uuid) is
  'Expires stale resident invites, revokes pending invites for already activated residents, and repairs duplicate active invite state.';

commit;
