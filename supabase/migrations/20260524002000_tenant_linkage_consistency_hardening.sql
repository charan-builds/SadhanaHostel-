-- Tenant linkage consistency hardening.
-- Adds database-side invariants for future writes and a scoped repair helper for
-- safe same-organization hostel linkage mismatches created during staging/UAT.

create or replace function public.validate_room_allocation_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Historical/completed allocations may point to residents that have since
  -- checked out or been archived. Keep the strict tenant invariant for active
  -- occupancy, while allowing repair jobs to close stale active rows safely.
  if new.status <> 'active'::public.room_allocation_status_enum then
    return new;
  end if;

  if not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
  ) then
    raise exception 'room_allocation_resident_tenant_mismatch';
  end if;

  if not exists (
    select 1
    from public.rooms rm
    where rm.id = new.room_id
      and rm.organization_id = new.organization_id
      and rm.hostel_id = new.hostel_id
      and rm.deleted_at is null
  ) then
    raise exception 'room_allocation_room_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_room_allocations_tenant_scope on public.room_allocations;
create trigger validate_room_allocations_tenant_scope
before insert or update on public.room_allocations
for each row
execute function public.validate_room_allocation_tenant_scope();

create or replace function public.validate_monthly_fee_record_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
      and r.deleted_at is null
  ) then
    raise exception 'monthly_fee_record_resident_tenant_mismatch';
  end if;

  if new.room_allocation_id is not null and not exists (
    select 1
    from public.room_allocations ra
    where ra.id = new.room_allocation_id
      and ra.organization_id = new.organization_id
      and ra.hostel_id = new.hostel_id
      and ra.resident_id = new.resident_id
  ) then
    raise exception 'monthly_fee_record_allocation_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_monthly_fee_records_tenant_scope on public.monthly_fee_records;
create trigger validate_monthly_fee_records_tenant_scope
before insert or update on public.monthly_fee_records
for each row
execute function public.validate_monthly_fee_record_tenant_scope();

create or replace function public.validate_invoice_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
  ) then
    raise exception 'invoice_resident_tenant_mismatch';
  end if;

  if new.monthly_fee_record_id is not null and not exists (
    select 1
    from public.monthly_fee_records mfr
    where mfr.id = new.monthly_fee_record_id
      and mfr.organization_id = new.organization_id
      and mfr.hostel_id = new.hostel_id
      and mfr.resident_id = new.resident_id
  ) then
    raise exception 'invoice_fee_record_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_invoices_tenant_scope on public.invoices;
create trigger validate_invoices_tenant_scope
before insert or update on public.invoices
for each row
execute function public.validate_invoice_tenant_scope();

create or replace function public.validate_reservation_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.leads l
    where l.id = new.lead_id
      and l.organization_id = new.organization_id
      and (l.hostel_id is null or l.hostel_id = new.hostel_id)
  ) then
    raise exception 'reservation_lead_tenant_mismatch';
  end if;

  if new.reserved_room_id is not null and not exists (
    select 1
    from public.rooms rm
    where rm.id = new.reserved_room_id
      and rm.organization_id = new.organization_id
      and rm.hostel_id = new.hostel_id
  ) then
    raise exception 'reservation_room_tenant_mismatch';
  end if;

  if new.converted_resident_id is not null and not exists (
    select 1
    from public.residents r
    where r.id = new.converted_resident_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
  ) then
    raise exception 'reservation_converted_resident_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reservations_tenant_scope on public.reservations;
create trigger validate_reservations_tenant_scope
before insert or update on public.reservations
for each row
execute function public.validate_reservation_tenant_scope();

create or replace function public.validate_payment_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
  ) then
    raise exception 'payment_resident_tenant_mismatch';
  end if;

  if new.monthly_fee_record_id is not null and not exists (
    select 1
    from public.monthly_fee_records mfr
    where mfr.id = new.monthly_fee_record_id
      and mfr.organization_id = new.organization_id
      and mfr.hostel_id = new.hostel_id
      and mfr.resident_id = new.resident_id
  ) then
    raise exception 'payment_fee_record_tenant_mismatch';
  end if;

  if new.invoice_id is not null and not exists (
    select 1
    from public.invoices i
    where i.id = new.invoice_id
      and i.organization_id = new.organization_id
      and i.hostel_id = new.hostel_id
      and i.resident_id = new.resident_id
  ) then
    raise exception 'payment_invoice_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_payments_tenant_scope on public.payments;
create trigger validate_payments_tenant_scope
before insert or update on public.payments
for each row
execute function public.validate_payment_tenant_scope();

create or replace function public.validate_document_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.storage_path not like new.organization_id::text || '/%' then
    raise exception 'document_storage_path_must_start_with_organization';
  end if;

  if new.bucket_name <> 'gallery-images' and new.is_public is true then
    raise exception 'private_document_cannot_be_public';
  end if;

  if new.resident_id is not null and not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and (new.hostel_id is null or r.hostel_id = new.hostel_id)
  ) then
    raise exception 'document_resident_tenant_mismatch';
  end if;

  if new.payment_id is not null and not exists (
    select 1
    from public.payments p
    where p.id = new.payment_id
      and p.organization_id = new.organization_id
      and (new.hostel_id is null or p.hostel_id = new.hostel_id)
      and (new.resident_id is null or p.resident_id = new.resident_id)
  ) then
    raise exception 'document_payment_tenant_mismatch';
  end if;

  if new.invoice_id is not null and not exists (
    select 1
    from public.invoices i
    where i.id = new.invoice_id
      and i.organization_id = new.organization_id
      and (new.hostel_id is null or i.hostel_id = new.hostel_id)
      and (new.resident_id is null or i.resident_id = new.resident_id)
  ) then
    raise exception 'document_invoice_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_documents_tenant_scope on public.documents;
create trigger validate_documents_tenant_scope
before insert or update on public.documents
for each row
execute function public.validate_document_tenant_scope();

create or replace function public.validate_resident_invite_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.residents r
    where r.id = new.resident_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
  ) then
    raise exception 'resident_invite_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_resident_invites_tenant_scope on public.resident_invites;
create trigger validate_resident_invites_tenant_scope
before insert or update on public.resident_invites
for each row
execute function public.validate_resident_invite_tenant_scope();

create or replace function public.validate_reservation_payment_tenant_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.reservations r
    where r.id = new.reservation_id
      and r.organization_id = new.organization_id
      and r.hostel_id = new.hostel_id
      and r.lead_id = new.lead_id
  ) then
    raise exception 'reservation_payment_reservation_tenant_mismatch';
  end if;

  if not exists (
    select 1
    from public.leads l
    where l.id = new.lead_id
      and l.organization_id = new.organization_id
      and (l.hostel_id is null or l.hostel_id = new.hostel_id)
  ) then
    raise exception 'reservation_payment_lead_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reservation_payments_tenant_scope on public.reservation_payments;
create trigger validate_reservation_payments_tenant_scope
before insert or update on public.reservation_payments
for each row
execute function public.validate_reservation_payment_tenant_scope();

create or replace function public.repair_tenant_linkage_consistency_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_room_allocations integer := 0;
  v_monthly_fee_records integer := 0;
  v_invoices integer := 0;
  v_payments integer := 0;
  v_invites integer := 0;
  v_reservations integer := 0;
  v_reservation_payments integer := 0;
  v_documents integer := 0;
  v_document_update integer := 0;
  v_recalculated_hostels integer := 0;
  v_hostel record;
begin
  if not public.can_manage_organization(p_organization_id, p_hostel_id) then
    raise exception 'tenant_linkage_repair_forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':tenant-linkage:' || coalesce(p_hostel_id::text, 'all'),
      0
    )
  );

  update public.room_allocations ra
  set
    organization_id = r.organization_id,
    hostel_id = r.hostel_id,
    reason = coalesce(ra.reason, 'Tenant linkage repaired from resident and room scope'),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.residents r,
    public.rooms rm
  where ra.resident_id = r.id
    and rm.id = ra.room_id
    and rm.organization_id = r.organization_id
    and rm.hostel_id = r.hostel_id
    and rm.deleted_at is null
    and ra.organization_id = p_organization_id
    and r.organization_id = p_organization_id
    and (p_hostel_id is null or ra.hostel_id = p_hostel_id or r.hostel_id = p_hostel_id)
    and ra.deleted_at is null
    and r.deleted_at is null
    and (ra.organization_id, ra.hostel_id) is distinct from (r.organization_id, r.hostel_id);

  get diagnostics v_room_allocations = row_count;

  update public.monthly_fee_records mfr
  set
    organization_id = r.organization_id,
    hostel_id = r.hostel_id,
    notes = concat_ws(E'\n', mfr.notes, 'Tenant linkage repaired from resident scope.'),
    metadata = mfr.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.residents r
  where mfr.resident_id = r.id
    and mfr.organization_id = p_organization_id
    and r.organization_id = p_organization_id
    and (p_hostel_id is null or mfr.hostel_id = p_hostel_id or r.hostel_id = p_hostel_id)
    and mfr.deleted_at is null
    and r.deleted_at is null
    and (
      mfr.room_allocation_id is null
      or exists (
        select 1
        from public.room_allocations ra
        where ra.id = mfr.room_allocation_id
          and ra.organization_id = r.organization_id
          and ra.hostel_id = r.hostel_id
          and ra.resident_id = r.id
          and ra.deleted_at is null
      )
    )
    and (mfr.organization_id, mfr.hostel_id) is distinct from (r.organization_id, r.hostel_id);

  get diagnostics v_monthly_fee_records = row_count;

  update public.invoices inv
  set
    organization_id = r.organization_id,
    hostel_id = r.hostel_id,
    metadata = inv.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.residents r
  where inv.resident_id = r.id
    and inv.organization_id = p_organization_id
    and r.organization_id = p_organization_id
    and (p_hostel_id is null or inv.hostel_id = p_hostel_id or r.hostel_id = p_hostel_id)
    and inv.deleted_at is null
    and r.deleted_at is null
    and (
      inv.monthly_fee_record_id is null
      or exists (
        select 1
        from public.monthly_fee_records mfr
        where mfr.id = inv.monthly_fee_record_id
          and mfr.organization_id = r.organization_id
          and mfr.hostel_id = r.hostel_id
          and mfr.resident_id = r.id
          and mfr.deleted_at is null
      )
    )
    and (inv.organization_id, inv.hostel_id) is distinct from (r.organization_id, r.hostel_id);

  get diagnostics v_invoices = row_count;

  update public.payments p
  set
    organization_id = r.organization_id,
    hostel_id = r.hostel_id,
    metadata = p.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.residents r
  where p.resident_id = r.id
    and p.organization_id = p_organization_id
    and r.organization_id = p_organization_id
    and (p_hostel_id is null or p.hostel_id = p_hostel_id or r.hostel_id = p_hostel_id)
    and p.deleted_at is null
    and r.deleted_at is null
    and (
      p.monthly_fee_record_id is null
      or exists (
        select 1
        from public.monthly_fee_records mfr
        where mfr.id = p.monthly_fee_record_id
          and mfr.organization_id = r.organization_id
          and mfr.hostel_id = r.hostel_id
          and mfr.resident_id = r.id
          and mfr.deleted_at is null
      )
    )
    and (
      p.invoice_id is null
      or exists (
        select 1
        from public.invoices inv
        where inv.id = p.invoice_id
          and inv.organization_id = r.organization_id
          and inv.hostel_id = r.hostel_id
          and inv.resident_id = r.id
          and inv.deleted_at is null
      )
    )
    and (p.organization_id, p.hostel_id) is distinct from (r.organization_id, r.hostel_id);

  get diagnostics v_payments = row_count;

  update public.resident_invites i
  set
    organization_id = r.organization_id,
    hostel_id = r.hostel_id,
    metadata = i.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.residents r
  where i.resident_id = r.id
    and i.organization_id = p_organization_id
    and r.organization_id = p_organization_id
    and (p_hostel_id is null or i.hostel_id = p_hostel_id or r.hostel_id = p_hostel_id)
    and r.deleted_at is null
    and (i.organization_id, i.hostel_id) is distinct from (r.organization_id, r.hostel_id);

  get diagnostics v_invites = row_count;

  update public.reservations rv
  set
    organization_id = l.organization_id,
    hostel_id = l.hostel_id,
    metadata = rv.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.leads l
  where rv.lead_id = l.id
    and rv.organization_id = p_organization_id
    and l.organization_id = p_organization_id
    and l.hostel_id is not null
    and (p_hostel_id is null or rv.hostel_id = p_hostel_id or l.hostel_id = p_hostel_id)
    and rv.deleted_at is null
    and l.deleted_at is null
    and (
      rv.reserved_room_id is null
      or exists (
        select 1
        from public.rooms rm
        where rm.id = rv.reserved_room_id
          and rm.organization_id = l.organization_id
          and rm.hostel_id = l.hostel_id
          and rm.deleted_at is null
      )
    )
    and (
      rv.converted_resident_id is null
      or exists (
        select 1
        from public.residents r
        where r.id = rv.converted_resident_id
          and r.organization_id = l.organization_id
          and r.hostel_id = l.hostel_id
          and r.deleted_at is null
      )
    )
    and (rv.organization_id, rv.hostel_id) is distinct from (l.organization_id, l.hostel_id);

  get diagnostics v_reservations = row_count;

  update public.reservation_payments rp
  set
    organization_id = rv.organization_id,
    hostel_id = rv.hostel_id,
    lead_id = rv.lead_id,
    metadata = rp.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.reservations rv
  where rp.reservation_id = rv.id
    and rp.organization_id = p_organization_id
    and rv.organization_id = p_organization_id
    and (p_hostel_id is null or rp.hostel_id = p_hostel_id or rv.hostel_id = p_hostel_id)
    and rp.deleted_at is null
    and rv.deleted_at is null
    and (
      rp.proof_document_id is null
      or exists (
        select 1
        from public.documents d
        where d.id = rp.proof_document_id
          and d.organization_id = rv.organization_id
          and (d.hostel_id is null or d.hostel_id = rv.hostel_id)
          and d.deleted_at is null
      )
    )
    and (
      rp.invoice_id is null
      or exists (
        select 1
        from public.invoices inv
        where inv.id = rp.invoice_id
          and inv.organization_id = rv.organization_id
          and inv.hostel_id = rv.hostel_id
          and inv.deleted_at is null
      )
    )
    and (
      (rp.organization_id, rp.hostel_id) is distinct from (rv.organization_id, rv.hostel_id)
      or rp.lead_id is distinct from rv.lead_id
    );

  get diagnostics v_reservation_payments = row_count;

  update public.documents d
  set
    hostel_id = p.hostel_id,
    resident_id = p.resident_id,
    metadata = d.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.payments p
  where d.payment_id = p.id
    and d.organization_id = p_organization_id
    and p.organization_id = p_organization_id
    and (p_hostel_id is null or d.hostel_id = p_hostel_id or p.hostel_id = p_hostel_id)
    and d.deleted_at is null
    and p.deleted_at is null
    and (
      d.hostel_id is distinct from p.hostel_id
      or d.resident_id is distinct from p.resident_id
    );

  get diagnostics v_documents = row_count;

  update public.documents d
  set
    hostel_id = inv.hostel_id,
    resident_id = inv.resident_id,
    metadata = d.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.invoices inv
  where d.payment_id is null
    and d.invoice_id = inv.id
    and d.organization_id = p_organization_id
    and inv.organization_id = p_organization_id
    and (p_hostel_id is null or d.hostel_id = p_hostel_id or inv.hostel_id = p_hostel_id)
    and d.deleted_at is null
    and inv.deleted_at is null
    and (
      d.hostel_id is distinct from inv.hostel_id
      or d.resident_id is distinct from inv.resident_id
    );

  get diagnostics v_document_update = row_count;
  v_documents := v_documents + v_document_update;

  update public.documents d
  set
    hostel_id = r.hostel_id,
    metadata = d.metadata || jsonb_build_object('tenant_linkage_repaired_at', now()),
    updated_by = p_actor_user_id,
    updated_at = now()
  from public.residents r
  where d.payment_id is null
    and d.invoice_id is null
    and d.resident_id = r.id
    and d.organization_id = p_organization_id
    and r.organization_id = p_organization_id
    and (p_hostel_id is null or d.hostel_id = p_hostel_id or r.hostel_id = p_hostel_id)
    and d.deleted_at is null
    and r.deleted_at is null
    and d.hostel_id is distinct from r.hostel_id;

  get diagnostics v_document_update = row_count;
  v_documents := v_documents + v_document_update;

  for v_hostel in
    select id
    from public.hostels
    where organization_id = p_organization_id
      and (p_hostel_id is null or id = p_hostel_id)
      and deleted_at is null
  loop
    perform public.recalculate_hostel_capacity(p_organization_id, v_hostel.id);
    v_recalculated_hostels := v_recalculated_hostels + 1;
  end loop;

  insert into public.audit_logs (
    organization_id,
    hostel_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    metadata,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_actor_user_id,
    'tenant_linkage',
    null,
    'tenant_linkage.consistency_repair',
    jsonb_build_object(
      'room_allocations_repaired', v_room_allocations,
      'monthly_fee_records_repaired', v_monthly_fee_records,
      'invoices_repaired', v_invoices,
      'payments_repaired', v_payments,
      'resident_invites_repaired', v_invites,
      'reservations_repaired', v_reservations,
      'reservation_payments_repaired', v_reservation_payments,
      'documents_repaired', v_documents,
      'hostels_recalculated', v_recalculated_hostels
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'roomAllocationsRepaired', v_room_allocations,
    'monthlyFeeRecordsRepaired', v_monthly_fee_records,
    'invoicesRepaired', v_invoices,
    'paymentsRepaired', v_payments,
    'residentInvitesRepaired', v_invites,
    'reservationsRepaired', v_reservations,
    'reservationPaymentsRepaired', v_reservation_payments,
    'documentsRepaired', v_documents,
    'hostelsRecalculated', v_recalculated_hostels
  );
end;
$$;

grant execute on function public.repair_tenant_linkage_consistency_atomic(uuid, uuid, uuid)
  to authenticated, service_role;
