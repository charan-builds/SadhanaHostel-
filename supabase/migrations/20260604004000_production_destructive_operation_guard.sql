-- Production destructive-operation guard.
--
-- This migration makes resident/finance hard deletes default-closed at the
-- database layer and requires non-production reset tooling to opt in from the
-- database itself. Production must keep both launch modes set to production and
-- destructive_operations_enabled=false.

begin;

create table if not exists public.operational_safety_settings (
  id boolean primary key default true,
  launch_mode text not null default 'production'
    check (launch_mode in ('local', 'staging', 'soft_launch', 'production')),
  next_public_launch_mode text not null default 'production'
    check (next_public_launch_mode in ('local', 'staging', 'soft_launch', 'production')),
  destructive_operations_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint operational_safety_settings_singleton_chk check (id is true)
);

insert into public.operational_safety_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.operational_safety_settings enable row level security;
alter table public.operational_safety_settings force row level security;

revoke all on table public.operational_safety_settings from public, anon, authenticated;

comment on table public.operational_safety_settings is
  'Singleton launch-safety flag. Production must keep launch_mode and next_public_launch_mode as production and destructive_operations_enabled=false.';
comment on column public.operational_safety_settings.destructive_operations_enabled is
  'Allows staging/local reset tooling and hard deletes only after the database is explicitly marked non-production.';

create or replace function public.assert_non_production_destructive_operation(
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.operational_safety_settings;
begin
  select *
  into v_settings
  from public.operational_safety_settings
  where id is true
  for update;

  if not found then
    raise exception 'production_destructive_operation_blocked:%', coalesce(p_operation, 'unknown')
      using errcode = '42501';
  end if;

  if v_settings.launch_mode = 'production'
     or v_settings.next_public_launch_mode = 'production' then
    raise exception 'production_destructive_operation_blocked:%', coalesce(p_operation, 'unknown')
      using errcode = '42501';
  end if;

  if not v_settings.destructive_operations_enabled then
    raise exception 'non_production_destructive_operations_disabled:%', coalesce(p_operation, 'unknown')
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.assert_non_production_destructive_operation(text) is
  'Database-layer launch gate for staging reset, sample data, and hard-delete operations. Default production settings block execution.';

revoke execute on function public.assert_non_production_destructive_operation(text)
  from public, anon, authenticated;
grant execute on function public.assert_non_production_destructive_operation(text)
  to service_role;

create or replace function public.prevent_production_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_non_production_destructive_operation(
    'hard_delete:' || tg_table_schema || '.' || tg_table_name
  );

  return old;
end;
$$;

comment on function public.prevent_production_hard_delete() is
  'Blocks hard deletes from resident and finance tables unless the database is explicitly configured as non-production with destructive operations enabled.';

drop trigger if exists prevent_production_payments_hard_delete on public.payments;
create trigger prevent_production_payments_hard_delete
before delete on public.payments
for each row
execute function public.prevent_production_hard_delete();

drop trigger if exists prevent_production_invoices_hard_delete on public.invoices;
create trigger prevent_production_invoices_hard_delete
before delete on public.invoices
for each row
execute function public.prevent_production_hard_delete();

drop trigger if exists prevent_production_monthly_fee_records_hard_delete on public.monthly_fee_records;
create trigger prevent_production_monthly_fee_records_hard_delete
before delete on public.monthly_fee_records
for each row
execute function public.prevent_production_hard_delete();

drop trigger if exists prevent_production_residents_hard_delete on public.residents;
create trigger prevent_production_residents_hard_delete
before delete on public.residents
for each row
execute function public.prevent_production_hard_delete();

drop trigger if exists prevent_production_documents_hard_delete on public.documents;
create trigger prevent_production_documents_hard_delete
before delete on public.documents
for each row
execute function public.prevent_production_hard_delete();

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

  perform public.assert_non_production_destructive_operation(
    'reset_resident_operational_data_for_staging'
  );

  if p_dry_run then
    return public.reset_resident_operational_data_for_staging_core(
      p_organization_id,
      p_hostel_id,
      p_actor_user_id,
      p_dry_run,
      p_confirmation
    );
  end if;

  execute 'alter table public.documents drop constraint if exists documents_payment_receipt_scope_chk';
  execute 'alter table public.documents drop constraint if exists documents_invoice_pdf_scope_chk';

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

  execute $sql$
    alter table public.documents
      add constraint documents_payment_receipt_scope_chk
      check (
        document_type <> 'payment_receipt'::public.document_type_enum
        or (
          bucket_name = 'payment-screenshots'
          and resident_id is not null
          and payment_id is not null
          and is_public is false
        )
      ) not valid
  $sql$;
  execute $sql$
    alter table public.documents
      add constraint documents_invoice_pdf_scope_chk
      check (
        document_type <> 'invoice_pdf'::public.document_type_enum
        or (
          bucket_name = 'invoices'
          and resident_id is not null
          and invoice_id is not null
          and is_public is false
        )
      ) not valid
  $sql$;

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
    execute 'alter table public.documents drop constraint if exists documents_payment_receipt_scope_chk';
    execute 'alter table public.documents drop constraint if exists documents_invoice_pdf_scope_chk';
    execute $sql$
      alter table public.documents
        add constraint documents_payment_receipt_scope_chk
        check (
          document_type <> 'payment_receipt'::public.document_type_enum
          or (
            bucket_name = 'payment-screenshots'
            and resident_id is not null
            and payment_id is not null
            and is_public is false
          )
        ) not valid
    $sql$;
    execute $sql$
      alter table public.documents
        add constraint documents_invoice_pdf_scope_chk
        check (
          document_type <> 'invoice_pdf'::public.document_type_enum
          or (
            bucket_name = 'invoices'
            and resident_id is not null
            and invoice_id is not null
            and is_public is false
          )
        ) not valid
    $sql$;

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
  'Owner/service-role staging reset wrapper. Database production-safety settings must explicitly allow destructive non-production operations before this function can run.';

revoke execute on function public.reset_resident_operational_data_for_staging_core(uuid, uuid, uuid, boolean, text)
from public, anon, authenticated;
revoke execute on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text)
from public, anon, authenticated;

grant execute on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text)
to service_role;

commit;
