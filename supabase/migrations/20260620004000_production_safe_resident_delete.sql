-- Keep the production hard-delete guard intact while providing the requested
-- resident deletion behavior through tenant-scoped operational soft deletion.

begin;

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
  v_deleted_at timestamptz := clock_timestamp();
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

  update public.documents
  set is_active = false,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;

  update public.advance_payment_allocations
  set deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;
  update public.advance_payment_refunds
  set deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;
  update public.advance_payment_deposits
  set deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;

  delete from public.payment_webhooks
  where payment_id in (
    select id
    from public.payments
    where organization_id = p_organization_id
      and resident_id = p_resident_id
  );

  update public.payments
  set is_active = false,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;
  update public.invoices
  set is_active = false,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;
  update public.monthly_fee_records
  set is_active = false,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;

  update public.room_allocations
  set is_active = false,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;
  update public.leave_requests
  set is_active = false,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;
  update public.support_requests
  set is_active = false,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;
  update public.notifications
  set is_active = false,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;
  update public.collection_followups
  set deleted_at = v_deleted_at,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where organization_id = p_organization_id
    and resident_id = p_resident_id
    and deleted_at is null;

  update public.residents
  set status = 'archived'::public.resident_status_enum,
      is_active = false,
      user_id = null,
      parent_user_id = null,
      deleted_at = v_deleted_at,
      deleted_by = p_actor_user_id,
      updated_at = v_deleted_at,
      updated_by = p_actor_user_id
  where id = p_resident_id
    and organization_id = p_organization_id;

  perform public.recalculate_hostel_capacity(
    v_resident.organization_id,
    v_resident.hostel_id
  );

  return jsonb_build_object(
    'residentId', v_resident.id,
    'organizationId', v_resident.organization_id,
    'hostelId', v_resident.hostel_id,
    'deletedBy', p_actor_user_id,
    'deletedAt', v_deleted_at
  );
end;
$$;

revoke execute on function public.delete_resident_operational_data_atomic(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.delete_resident_operational_data_atomic(uuid, uuid, uuid)
to service_role;

commit;
