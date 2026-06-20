-- Production fee workflow support, resident purge, and revenue semantics.

begin;

create or replace function public.purge_resident_dependents_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.documents
  where organization_id = old.organization_id
    and resident_id = old.id;

  delete from public.advance_payment_refund_audit_logs
  where organization_id = old.organization_id
    and resident_id = old.id;
  delete from public.advance_payment_allocations
  where organization_id = old.organization_id
    and resident_id = old.id;
  delete from public.advance_payment_refunds
  where organization_id = old.organization_id
    and resident_id = old.id;
  delete from public.advance_payment_deposits
  where organization_id = old.organization_id
    and resident_id = old.id;

  delete from public.payment_webhooks
  where payment_id in (
    select id
    from public.payments
    where organization_id = old.organization_id
      and resident_id = old.id
  );
  delete from public.payments
  where organization_id = old.organization_id
    and resident_id = old.id;
  delete from public.invoices
  where organization_id = old.organization_id
    and resident_id = old.id;
  delete from public.monthly_fee_records
  where organization_id = old.organization_id
    and resident_id = old.id;

  delete from public.room_allocations
  where organization_id = old.organization_id
    and resident_id = old.id;
  delete from public.leave_requests
  where organization_id = old.organization_id
    and resident_id = old.id;
  delete from public.support_requests
  where organization_id = old.organization_id
    and resident_id = old.id;
  delete from public.notifications
  where organization_id = old.organization_id
    and resident_id = old.id;

  delete from public.audit_logs
  where organization_id = old.organization_id
    and (
      record_id = old.id
      or metadata ->> 'residentId' = old.id::text
      or metadata ->> 'resident_id' = old.id::text
    );

  return old;
end;
$$;

drop trigger if exists purge_resident_dependents_before_delete_trg
  on public.residents;
create trigger purge_resident_dependents_before_delete_trg
before delete on public.residents
for each row
execute function public.purge_resident_dependents_before_delete();

create or replace function public.delete_resident_operational_data_atomic(
  p_organization_id uuid,
  p_resident_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resident public.residents%rowtype;
begin
  perform public.assert_service_role_rpc(
    'delete_resident_operational_data_atomic'
  );

  select *
  into v_resident
  from public.residents
  where id = p_resident_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'resident_not_found' using errcode = 'P0002';
  end if;

  delete from public.residents
  where id = v_resident.id
    and organization_id = v_resident.organization_id;

  return jsonb_build_object(
    'residentId', v_resident.id,
    'organizationId', v_resident.organization_id,
    'hostelId', v_resident.hostel_id,
    'deletedBy', p_actor_user_id
  );
end;
$$;

revoke execute on function public.purge_resident_dependents_before_delete()
from public, anon, authenticated;
revoke execute on function public.delete_resident_operational_data_atomic(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.delete_resident_operational_data_atomic(uuid, uuid, uuid)
to service_role;

-- Revenue includes every verified payment: admission/monthly collections and
-- advance collected. Advance allocations do not create payment rows and
-- therefore never increase revenue.
create or replace function public.finance_dashboard_aggregates(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_today date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_manage_finance(p_organization_id, p_hostel_id) then
    raise exception 'finance_dashboard_forbidden' using errcode = '42501';
  end if;

  return public.finance_dashboard_aggregates_including_advance(
    p_organization_id,
    p_hostel_id,
    p_today
  );
end;
$$;

revoke execute on function public.finance_dashboard_aggregates(uuid, uuid, date)
from public, anon;
grant execute on function public.finance_dashboard_aggregates(uuid, uuid, date)
to authenticated, service_role;

commit;
