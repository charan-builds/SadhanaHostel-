-- Allow owner-controlled demo resets to clean already-corrupted tenant-linkage rows.
--
-- Some staging/demo records can be inconsistent before the reset starts. Deleting
-- a payment can set document.payment_id to null, and deleting a document can set
-- invoice.pdf_document_id to null; both are implemented by FK-triggered updates.
-- Tenant validation triggers then re-check the old corrupted links and block the
-- reset. The wrapper below keeps the original owner/service-role checks in the
-- core reset function, but suspends only tenant-linkage validation triggers while
-- the selected reset rows are removed.

begin;

alter function public.reset_resident_operational_data_for_staging(
  uuid,
  uuid,
  uuid,
  boolean,
  text
) rename to reset_resident_operational_data_for_staging_core;

create or replace function public.reset_resident_operational_data_for_staging(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null,
  p_dry_run boolean default true,
  p_confirmation text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.is_service_context() then
    raise exception 'demo_data_reset_service_role_required';
  end if;

  if p_dry_run then
    return public.reset_resident_operational_data_for_staging_core(
      p_organization_id,
      p_hostel_id,
      p_actor_user_id,
      p_dry_run,
      p_confirmation
    );
  end if;

  execute 'alter table public.room_allocations disable trigger validate_room_allocations_tenant_scope';
  execute 'alter table public.monthly_fee_records disable trigger validate_monthly_fee_records_tenant_scope';
  execute 'alter table public.invoices disable trigger validate_invoices_tenant_scope';
  execute 'alter table public.reservations disable trigger validate_reservations_tenant_scope';
  execute 'alter table public.payments disable trigger validate_payments_tenant_scope';
  execute 'alter table public.documents disable trigger validate_documents_tenant_scope';
  execute 'alter table public.resident_invites disable trigger validate_resident_invites_tenant_scope';
  execute 'alter table public.reservation_payments disable trigger validate_reservation_payments_tenant_scope';

  v_result := public.reset_resident_operational_data_for_staging_core(
    p_organization_id,
    p_hostel_id,
    p_actor_user_id,
    p_dry_run,
    p_confirmation
  );

  execute 'alter table public.reservation_payments enable trigger validate_reservation_payments_tenant_scope';
  execute 'alter table public.resident_invites enable trigger validate_resident_invites_tenant_scope';
  execute 'alter table public.documents enable trigger validate_documents_tenant_scope';
  execute 'alter table public.payments enable trigger validate_payments_tenant_scope';
  execute 'alter table public.reservations enable trigger validate_reservations_tenant_scope';
  execute 'alter table public.invoices enable trigger validate_invoices_tenant_scope';
  execute 'alter table public.monthly_fee_records enable trigger validate_monthly_fee_records_tenant_scope';
  execute 'alter table public.room_allocations enable trigger validate_room_allocations_tenant_scope';

  return v_result;
exception
  when others then
    execute 'alter table public.reservation_payments enable trigger validate_reservation_payments_tenant_scope';
    execute 'alter table public.resident_invites enable trigger validate_resident_invites_tenant_scope';
    execute 'alter table public.documents enable trigger validate_documents_tenant_scope';
    execute 'alter table public.payments enable trigger validate_payments_tenant_scope';
    execute 'alter table public.reservations enable trigger validate_reservations_tenant_scope';
    execute 'alter table public.invoices enable trigger validate_invoices_tenant_scope';
    execute 'alter table public.monthly_fee_records enable trigger validate_monthly_fee_records_tenant_scope';
    execute 'alter table public.room_allocations enable trigger validate_room_allocations_tenant_scope';
    raise;
end;
$$;

comment on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text) is
  'Owner/service-role staging reset wrapper. Temporarily suspends tenant-linkage validation triggers so already-corrupted demo rows can be removed, then re-enables them.';

revoke execute on function public.reset_resident_operational_data_for_staging_core(uuid, uuid, uuid, boolean, text)
from public, anon, authenticated;
revoke execute on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text)
from public, anon, authenticated;

grant execute on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text)
to service_role;

commit;
