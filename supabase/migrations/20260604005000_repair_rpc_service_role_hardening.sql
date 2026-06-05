-- Service-role hardening for repair, reconciliation, and maintenance RPCs.
--
-- These RPCs are intentionally callable only through trusted server-side
-- services after application authorization. Direct browser/authenticated
-- invocation is blocked by grants and by the wrapper-level service-role check.

begin;

create or replace function public.assert_service_role_rpc(
  p_function_name text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_service_context() then
    raise exception 'service_role_rpc_required:%', coalesce(p_function_name, 'unknown')
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.assert_service_role_rpc(text) is
  'Shared guard for repair, maintenance, and reconciliation RPC wrappers. SECURITY DEFINER ownership alone is not trusted; the caller must be service-role context.';

revoke execute on function public.assert_service_role_rpc(text)
  from public, anon, authenticated;
grant execute on function public.assert_service_role_rpc(text)
  to service_role;

do $$
begin
  if to_regprocedure('public.financial_reconciliation_counts(uuid, uuid)') is not null
     and to_regprocedure('public.financial_reconciliation_counts_core(uuid, uuid)') is null then
    alter function public.financial_reconciliation_counts(uuid, uuid)
      rename to financial_reconciliation_counts_core;
  end if;
end;
$$;

create or replace function public.financial_reconciliation_counts(
  p_organization_id uuid,
  p_hostel_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('financial_reconciliation_counts');

  return public.financial_reconciliation_counts_core(
    p_organization_id,
    p_hostel_id
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.list_verified_payments_missing_receipts(uuid, uuid, integer)') is not null
     and to_regprocedure('public.list_verified_payments_missing_receipts_core(uuid, uuid, integer)') is null then
    alter function public.list_verified_payments_missing_receipts(uuid, uuid, integer)
      rename to list_verified_payments_missing_receipts_core;
  end if;
end;
$$;

create or replace function public.list_verified_payments_missing_receipts(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_limit integer default 100
)
returns setof public.payments
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('list_verified_payments_missing_receipts');

  return query
  select *
  from public.list_verified_payments_missing_receipts_core(
    p_organization_id,
    p_hostel_id,
    p_limit
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.repair_monthly_fee_invoices_atomic(uuid, uuid, uuid, boolean)') is not null
     and to_regprocedure('public.repair_monthly_fee_invoices_atomic_core(uuid, uuid, uuid, boolean)') is null then
    alter function public.repair_monthly_fee_invoices_atomic(uuid, uuid, uuid, boolean)
      rename to repair_monthly_fee_invoices_atomic_core;
  end if;
end;
$$;

create or replace function public.repair_monthly_fee_invoices_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('repair_monthly_fee_invoices_atomic');

  return public.repair_monthly_fee_invoices_atomic_core(
    p_organization_id,
    p_hostel_id,
    p_actor_user_id,
    p_dry_run
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.repair_advance_payment_invoices_atomic(uuid, uuid, uuid, boolean)') is not null
     and to_regprocedure('public.repair_advance_payment_invoices_atomic_core(uuid, uuid, uuid, boolean)') is null then
    alter function public.repair_advance_payment_invoices_atomic(uuid, uuid, uuid, boolean)
      rename to repair_advance_payment_invoices_atomic_core;
  end if;
end;
$$;

create or replace function public.repair_advance_payment_invoices_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('repair_advance_payment_invoices_atomic');

  return public.repair_advance_payment_invoices_atomic_core(
    p_organization_id,
    p_hostel_id,
    p_actor_user_id,
    p_dry_run
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.repair_receipt_invoice_links_atomic(uuid, uuid, uuid, boolean)') is not null
     and to_regprocedure('public.repair_receipt_invoice_links_atomic_core(uuid, uuid, uuid, boolean)') is null then
    alter function public.repair_receipt_invoice_links_atomic(uuid, uuid, uuid, boolean)
      rename to repair_receipt_invoice_links_atomic_core;
  end if;
end;
$$;

create or replace function public.repair_receipt_invoice_links_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('repair_receipt_invoice_links_atomic');

  return public.repair_receipt_invoice_links_atomic_core(
    p_organization_id,
    p_hostel_id,
    p_actor_user_id,
    p_dry_run
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.repair_resident_lifecycle_atomic(uuid, uuid, uuid, boolean)') is not null
     and to_regprocedure('public.repair_resident_lifecycle_atomic_core(uuid, uuid, uuid, boolean)') is null then
    alter function public.repair_resident_lifecycle_atomic(uuid, uuid, uuid, boolean)
      rename to repair_resident_lifecycle_atomic_core;
  end if;
end;
$$;

create or replace function public.repair_resident_lifecycle_atomic(
  p_organization_id uuid,
  p_resident_id uuid,
  p_actor_user_id uuid default auth.uid(),
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('repair_resident_lifecycle_atomic');

  return public.repair_resident_lifecycle_atomic_core(
    p_organization_id,
    p_resident_id,
    p_actor_user_id,
    p_dry_run
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.repair_onboarding_access_consistency_atomic(uuid, uuid, integer, uuid)') is not null
     and to_regprocedure('public.repair_onboarding_access_consistency_atomic_core(uuid, uuid, integer, uuid)') is null then
    alter function public.repair_onboarding_access_consistency_atomic(uuid, uuid, integer, uuid)
      rename to repair_onboarding_access_consistency_atomic_core;
  end if;
end;
$$;

create or replace function public.repair_onboarding_access_consistency_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_limit integer default 500,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('repair_onboarding_access_consistency_atomic');

  return public.repair_onboarding_access_consistency_atomic_core(
    p_organization_id,
    p_hostel_id,
    p_limit,
    p_actor_user_id
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.reconcile_invalid_dues_atomic(uuid, uuid, integer, uuid)') is not null
     and to_regprocedure('public.reconcile_invalid_dues_atomic_core(uuid, uuid, integer, uuid)') is null then
    alter function public.reconcile_invalid_dues_atomic(uuid, uuid, integer, uuid)
      rename to reconcile_invalid_dues_atomic_core;
  end if;
end;
$$;

create or replace function public.reconcile_invalid_dues_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_limit integer default 500,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('reconcile_invalid_dues_atomic');

  return public.reconcile_invalid_dues_atomic_core(
    p_organization_id,
    p_hostel_id,
    p_limit,
    p_actor_user_id
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.repair_analytics_consistency_atomic(uuid, uuid, uuid)') is not null
     and to_regprocedure('public.repair_analytics_consistency_atomic_core(uuid, uuid, uuid)') is null then
    alter function public.repair_analytics_consistency_atomic(uuid, uuid, uuid)
      rename to repair_analytics_consistency_atomic_core;
  end if;
end;
$$;

create or replace function public.repair_analytics_consistency_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('repair_analytics_consistency_atomic');

  return public.repair_analytics_consistency_atomic_core(
    p_organization_id,
    p_hostel_id,
    p_actor_user_id
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.repair_tenant_linkage_consistency_atomic(uuid, uuid, uuid)') is not null
     and to_regprocedure('public.repair_tenant_linkage_consistency_atomic_core(uuid, uuid, uuid)') is null then
    alter function public.repair_tenant_linkage_consistency_atomic(uuid, uuid, uuid)
      rename to repair_tenant_linkage_consistency_atomic_core;
  end if;
end;
$$;

create or replace function public.repair_tenant_linkage_consistency_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('repair_tenant_linkage_consistency_atomic');

  return public.repair_tenant_linkage_consistency_atomic_core(
    p_organization_id,
    p_hostel_id,
    p_actor_user_id
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.repair_occupancy_consistency_atomic(uuid, uuid, uuid)') is not null
     and to_regprocedure('public.repair_occupancy_consistency_atomic_core(uuid, uuid, uuid)') is null then
    alter function public.repair_occupancy_consistency_atomic(uuid, uuid, uuid)
      rename to repair_occupancy_consistency_atomic_core;
  end if;
end;
$$;

create or replace function public.repair_occupancy_consistency_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('repair_occupancy_consistency_atomic');

  return public.repair_occupancy_consistency_atomic_core(
    p_organization_id,
    p_hostel_id,
    p_actor_user_id
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.cleanup_resident_onboarding_access(uuid, uuid, integer, uuid)') is not null
     and to_regprocedure('public.cleanup_resident_onboarding_access_core(uuid, uuid, integer, uuid)') is null then
    alter function public.cleanup_resident_onboarding_access(uuid, uuid, integer, uuid)
      rename to cleanup_resident_onboarding_access_core;
  end if;
end;
$$;

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
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('cleanup_resident_onboarding_access');

  return query
  select *
  from public.cleanup_resident_onboarding_access_core(
    p_organization_id,
    p_hostel_id,
    p_limit,
    p_actor_user_id
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.get_resident_tenant_identity_anomaly_report(uuid, uuid, integer)') is not null
     and to_regprocedure('public.get_resident_tenant_identity_anomaly_report_core(uuid, uuid, integer)') is null then
    alter function public.get_resident_tenant_identity_anomaly_report(uuid, uuid, integer)
      rename to get_resident_tenant_identity_anomaly_report_core;
  end if;
end;
$$;

create or replace function public.get_resident_tenant_identity_anomaly_report(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_limit integer default 100
)
returns table (
  table_name text,
  record_id uuid,
  resident_id uuid,
  organization_id uuid,
  hostel_id uuid,
  user_id uuid,
  expected_organization_id uuid,
  expected_hostel_id uuid,
  anomaly_type text,
  expected_state text,
  actual_state text,
  recommended_repair_action text,
  recommendation text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('get_resident_tenant_identity_anomaly_report');

  return query
  select *
  from public.get_resident_tenant_identity_anomaly_report_core(
    p_organization_id,
    p_hostel_id,
    p_limit
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.expire_resident_invites(uuid, uuid, integer)') is not null
     and to_regprocedure('public.expire_resident_invites_core(uuid, uuid, integer)') is null then
    alter function public.expire_resident_invites(uuid, uuid, integer)
      rename to expire_resident_invites_core;
  end if;
end;
$$;

create or replace function public.expire_resident_invites(
  p_organization_id uuid default null,
  p_hostel_id uuid default null,
  p_limit integer default 500
)
returns table (
  expired_count integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('expire_resident_invites');

  return query
  select *
  from public.expire_resident_invites_core(
    p_organization_id,
    p_hostel_id,
    p_limit
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.expire_reservations(uuid, uuid, integer)') is not null
     and to_regprocedure('public.expire_reservations_core(uuid, uuid, integer)') is null then
    alter function public.expire_reservations(uuid, uuid, integer)
      rename to expire_reservations_core;
  end if;
end;
$$;

create or replace function public.expire_reservations(
  p_organization_id uuid default null,
  p_hostel_id uuid default null,
  p_limit integer default 200
)
returns table (
  expired_count integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_service_role_rpc('expire_reservations');

  return query
  select *
  from public.expire_reservations_core(
    p_organization_id,
    p_hostel_id,
    p_limit
  );
end;
$$;

revoke execute on function public.financial_reconciliation_counts(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.list_verified_payments_missing_receipts(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.repair_monthly_fee_invoices_atomic(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.repair_advance_payment_invoices_atomic(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.repair_receipt_invoice_links_atomic(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.repair_resident_lifecycle_atomic(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.repair_onboarding_access_consistency_atomic(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.reconcile_invalid_dues_atomic(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.repair_analytics_consistency_atomic(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.repair_tenant_linkage_consistency_atomic(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.repair_occupancy_consistency_atomic(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.cleanup_resident_onboarding_access(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.get_resident_tenant_identity_anomaly_report(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.expire_resident_invites(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.expire_reservations(uuid, uuid, integer) from public, anon, authenticated;

grant execute on function public.financial_reconciliation_counts(uuid, uuid) to service_role;
grant execute on function public.list_verified_payments_missing_receipts(uuid, uuid, integer) to service_role;
grant execute on function public.repair_monthly_fee_invoices_atomic(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.repair_advance_payment_invoices_atomic(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.repair_receipt_invoice_links_atomic(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.repair_resident_lifecycle_atomic(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.repair_onboarding_access_consistency_atomic(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.reconcile_invalid_dues_atomic(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.repair_analytics_consistency_atomic(uuid, uuid, uuid) to service_role;
grant execute on function public.repair_tenant_linkage_consistency_atomic(uuid, uuid, uuid) to service_role;
grant execute on function public.repair_occupancy_consistency_atomic(uuid, uuid, uuid) to service_role;
grant execute on function public.cleanup_resident_onboarding_access(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.get_resident_tenant_identity_anomaly_report(uuid, uuid, integer) to service_role;
grant execute on function public.expire_resident_invites(uuid, uuid, integer) to service_role;
grant execute on function public.expire_reservations(uuid, uuid, integer) to service_role;

revoke execute on function public.financial_reconciliation_counts_core(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.list_verified_payments_missing_receipts_core(uuid, uuid, integer) from public, anon, authenticated, service_role;
revoke execute on function public.repair_monthly_fee_invoices_atomic_core(uuid, uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.repair_advance_payment_invoices_atomic_core(uuid, uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.repair_receipt_invoice_links_atomic_core(uuid, uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.repair_resident_lifecycle_atomic_core(uuid, uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.repair_onboarding_access_consistency_atomic_core(uuid, uuid, integer, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.reconcile_invalid_dues_atomic_core(uuid, uuid, integer, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.repair_analytics_consistency_atomic_core(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.repair_tenant_linkage_consistency_atomic_core(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.repair_occupancy_consistency_atomic_core(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.cleanup_resident_onboarding_access_core(uuid, uuid, integer, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.get_resident_tenant_identity_anomaly_report_core(uuid, uuid, integer) from public, anon, authenticated, service_role;
revoke execute on function public.expire_resident_invites_core(uuid, uuid, integer) from public, anon, authenticated, service_role;
revoke execute on function public.expire_reservations_core(uuid, uuid, integer) from public, anon, authenticated, service_role;

revoke execute on function public.reset_resident_operational_data_for_staging_core(uuid, uuid, uuid, boolean, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text)
  to service_role;

revoke execute on function public.repair_resident_auth_identity_atomic(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.repair_resident_auth_identity_atomic(uuid, uuid, uuid, text, text, text)
  to service_role;

commit;
