-- Production-safe financial reconciliation helpers.
-- These functions are intentionally idempotent and scoped by tenant.

create unique index if not exists invoices_payment_receipt_payment_uidx
  on public.invoices (organization_id, ((metadata->>'payment_id')))
  where deleted_at is null
    and monthly_fee_record_id is null
    and metadata->>'source' = 'payment_receipt'
    and metadata->>'payment_id' is not null;

create or replace function public.financial_reconciliation_counts(
  p_organization_id uuid,
  p_hostel_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  with scoped_payments as (
    select *
    from public.payments p
    where p.organization_id = p_organization_id
      and (p_hostel_id is null or p.hostel_id = p_hostel_id)
      and p.deleted_at is null
  ),
  scoped_fee_records as (
    select *
    from public.monthly_fee_records mfr
    where mfr.organization_id = p_organization_id
      and (p_hostel_id is null or mfr.hostel_id = p_hostel_id)
      and mfr.deleted_at is null
  ),
  scoped_receipts as (
    select d.*
    from public.documents d
    join scoped_payments p on p.id = d.payment_id
    where d.organization_id = p_organization_id
      and (p_hostel_id is null or d.hostel_id = p_hostel_id)
      and d.document_type = 'payment_receipt'::public.document_type_enum
      and d.deleted_at is null
  )
  select jsonb_build_object(
    'verified_payments_missing_invoice',
      (select count(*)
       from scoped_payments p
       where p.status = 'verified'::public.payment_status_enum
         and p.invoice_id is null),
    'paid_zero_balance_fee_records_missing_invoice',
      (select count(*)
       from scoped_fee_records mfr
       where mfr.balance_amount = 0
         and not exists (
           select 1
           from public.invoices i
           where i.organization_id = mfr.organization_id
             and i.monthly_fee_record_id = mfr.id
             and i.deleted_at is null
         )),
    'verified_receipt_documents_missing_invoice_link',
      (select count(*)
       from scoped_receipts d
       join scoped_payments p on p.id = d.payment_id
       where d.status = 'verified'::public.document_status_enum
         and d.invoice_id is null
         and p.status = 'verified'::public.payment_status_enum
         and p.invoice_id is not null),
    'verified_payments_missing_receipt',
      (select count(*)
       from scoped_payments p
       where p.status = 'verified'::public.payment_status_enum
         and not exists (
           select 1
           from public.documents d
           where d.payment_id = p.id
             and d.document_type = 'payment_receipt'::public.document_type_enum
             and d.status = 'verified'::public.document_status_enum
             and d.deleted_at is null
         )),
    'paid_invoice_payment_total_mismatch',
      (select count(*)
       from (
         select i.id
         from public.invoices i
         left join scoped_payments p
           on p.invoice_id = i.id
          and p.status = 'verified'::public.payment_status_enum
         where i.organization_id = p_organization_id
           and (p_hostel_id is null or i.hostel_id = p_hostel_id)
           and i.status = 'paid'::public.invoice_status_enum
           and i.deleted_at is null
         group by i.id, i.total_amount
         having coalesce(sum(p.amount), 0) <> i.total_amount
       ) mismatched_invoices)
  );
$$;

create or replace function public.list_verified_payments_missing_receipts(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_limit integer default 100
)
returns setof public.payments
language sql
security invoker
set search_path = public
as $$
  select p.*
  from public.payments p
  where p.organization_id = p_organization_id
    and (p_hostel_id is null or p.hostel_id = p_hostel_id)
    and p.status = 'verified'::public.payment_status_enum
    and p.deleted_at is null
    and not exists (
      select 1
      from public.documents d
      where d.payment_id = p.id
        and d.document_type = 'payment_receipt'::public.document_type_enum
        and d.status = 'verified'::public.document_status_enum
        and d.deleted_at is null
    )
  order by p.verified_at nulls last, p.created_at
  limit least(greatest(p_limit, 1), 500);
$$;

create or replace function public.repair_monthly_fee_invoices_atomic(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec record;
  v_invoice public.invoices;
  v_candidates integer := 0;
  v_invoices_created integer := 0;
  v_payments_linked integer := 0;
  v_payment_links integer := 0;
begin
  select count(*)
  into v_candidates
  from public.monthly_fee_records mfr
  where mfr.organization_id = p_organization_id
    and (p_hostel_id is null or mfr.hostel_id = p_hostel_id)
    and mfr.balance_amount = 0
    and mfr.deleted_at is null
    and not exists (
      select 1
      from public.invoices i
      where i.organization_id = mfr.organization_id
        and i.monthly_fee_record_id = mfr.id
        and i.deleted_at is null
    );

  if p_dry_run then
    return jsonb_build_object(
      'dryRun', true,
      'candidates', v_candidates,
      'invoicesCreated', 0,
      'paymentsLinked', 0
    );
  end if;

  for rec in
    select mfr.id, mfr.organization_id
    from public.monthly_fee_records mfr
    where mfr.organization_id = p_organization_id
      and (p_hostel_id is null or mfr.hostel_id = p_hostel_id)
      and mfr.balance_amount = 0
      and mfr.deleted_at is null
      and not exists (
        select 1
        from public.invoices i
        where i.organization_id = mfr.organization_id
          and i.monthly_fee_record_id = mfr.id
          and i.deleted_at is null
      )
    order by mfr.period_month, mfr.created_at
  loop
    v_invoice := public.create_monthly_fee_invoice_atomic(
      rec.organization_id,
      rec.id,
      p_actor_user_id
    );
    v_invoices_created := v_invoices_created + 1;

    update public.payments p
    set invoice_id = v_invoice.id,
        updated_at = now(),
        updated_by = coalesce(p_actor_user_id, p.updated_by),
        metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
          'financial_repair_invoice_linked_at', now(),
          'financial_repair_invoice_id', v_invoice.id,
          'financial_repair_action', 'repair_monthly_fee_invoices'
        )
    where p.organization_id = p_organization_id
      and (p_hostel_id is null or p.hostel_id = p_hostel_id)
      and p.status = 'verified'::public.payment_status_enum
      and p.invoice_id is null
      and p.monthly_fee_record_id = rec.id
      and p.deleted_at is null;

    get diagnostics v_payment_links = row_count;
    v_payments_linked := v_payments_linked + v_payment_links;
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
    'financial_reconciliation',
    null,
    'financial_reconciliation.monthly_fee_invoices_repaired',
    jsonb_build_object(
      'candidates', v_candidates,
      'invoicesCreated', v_invoices_created,
      'paymentsLinked', v_payments_linked
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'dryRun', false,
    'candidates', v_candidates,
    'invoicesCreated', v_invoices_created,
    'paymentsLinked', v_payments_linked
  );
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
security invoker
set search_path = public
as $$
declare
  rec public.payments;
  v_existing_invoice public.invoices;
  v_new_invoice public.invoices;
  v_org_slug text;
  v_issue_day date;
  v_issue_month text;
  v_sequence integer;
  v_prefix text;
  v_invoice_number text;
  v_candidates integer := 0;
  v_invoices_created integer := 0;
  v_payments_linked integer := 0;
begin
  select count(*)
  into v_candidates
  from public.payments p
  where p.organization_id = p_organization_id
    and (p_hostel_id is null or p.hostel_id = p_hostel_id)
    and p.status = 'verified'::public.payment_status_enum
    and p.invoice_id is null
    and p.monthly_fee_record_id is null
    and p.is_advance is true
    and p.deleted_at is null;

  if p_dry_run then
    return jsonb_build_object(
      'dryRun', true,
      'candidates', v_candidates,
      'invoicesCreated', 0,
      'paymentsLinked', 0
    );
  end if;

  select slug
  into v_org_slug
  from public.organizations
  where id = p_organization_id
    and deleted_at is null;

  for rec in
    select *
    from public.payments p
    where p.organization_id = p_organization_id
      and (p_hostel_id is null or p.hostel_id = p_hostel_id)
      and p.status = 'verified'::public.payment_status_enum
      and p.invoice_id is null
      and p.monthly_fee_record_id is null
      and p.is_advance is true
      and p.deleted_at is null
    order by p.verified_at, p.created_at
  loop
    perform pg_advisory_xact_lock(hashtextextended(rec.organization_id::text || ':payment-receipt:' || rec.id::text, 0));

    select *
    into v_existing_invoice
    from public.invoices i
    where i.organization_id = rec.organization_id
      and i.deleted_at is null
      and i.monthly_fee_record_id is null
      and i.metadata->>'source' = 'payment_receipt'
      and i.metadata->>'payment_id' = rec.id::text
    limit 1;

    if found then
      update public.payments p
      set invoice_id = v_existing_invoice.id,
          updated_at = now(),
          updated_by = coalesce(p_actor_user_id, p.updated_by)
      where p.id = rec.id
        and p.invoice_id is null;

      v_payments_linked := v_payments_linked + 1;
    else
      v_issue_day := coalesce(rec.paid_at, rec.verified_at, rec.created_at)::date;
      v_issue_month := to_char(v_issue_day, 'YYYYMM');

      perform pg_advisory_xact_lock(hashtextextended(rec.organization_id::text || ':invoice:' || v_issue_month, 0));

      select count(*)::integer + 1
      into v_sequence
      from public.invoices
      where organization_id = rec.organization_id
        and issue_date >= date_trunc('month', v_issue_day)::date
        and issue_date < (date_trunc('month', v_issue_day)::date + interval '1 month')
        and deleted_at is null;

      v_prefix := left(regexp_replace(upper(coalesce(v_org_slug, 'SBH')), '[^A-Z0-9]+', '-', 'g'), 12);
      v_prefix := coalesce(nullif(trim(both '-' from v_prefix), ''), 'SBH');
      v_invoice_number := format('%s-%s-%s', v_prefix, v_issue_month, lpad(v_sequence::text, 6, '0'));

      insert into public.invoices (
        organization_id,
        hostel_id,
        resident_id,
        monthly_fee_record_id,
        invoice_number,
        status,
        issue_date,
        due_date,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        paid_amount,
        balance_amount,
        metadata,
        created_by,
        updated_by
      )
      values (
        rec.organization_id,
        rec.hostel_id,
        rec.resident_id,
        null,
        v_invoice_number,
        'paid'::public.invoice_status_enum,
        v_issue_day,
        v_issue_day,
        rec.amount,
        0,
        0,
        rec.amount,
        rec.amount,
        0,
        jsonb_build_object(
          'source', 'payment_receipt',
          'payment_id', rec.id,
          'payment_method', rec.method,
          'transaction_id', rec.transaction_id,
          'manual_reference', rec.manual_reference,
          'is_advance', rec.is_advance,
          'financial_repair', true,
          'financial_repair_created_at', now()
        ),
        p_actor_user_id,
        p_actor_user_id
      )
      returning * into v_new_invoice;

      v_invoices_created := v_invoices_created + 1;

      update public.payments p
      set invoice_id = v_new_invoice.id,
          updated_at = now(),
          updated_by = coalesce(p_actor_user_id, p.updated_by),
          metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
            'financial_repair_invoice_linked_at', now(),
            'financial_repair_invoice_id', v_new_invoice.id,
            'financial_repair_action', 'repair_advance_payment_invoices'
          )
      where p.id = rec.id
        and p.invoice_id is null;

      v_payments_linked := v_payments_linked + 1;
    end if;
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
    'financial_reconciliation',
    null,
    'financial_reconciliation.advance_payment_invoices_repaired',
    jsonb_build_object(
      'candidates', v_candidates,
      'invoicesCreated', v_invoices_created,
      'paymentsLinked', v_payments_linked
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'dryRun', false,
    'candidates', v_candidates,
    'invoicesCreated', v_invoices_created,
    'paymentsLinked', v_payments_linked
  );
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
security invoker
set search_path = public
as $$
declare
  v_candidates integer := 0;
  v_documents_linked integer := 0;
begin
  select count(*)
  into v_candidates
  from public.documents d
  join public.payments p on p.id = d.payment_id
  where d.organization_id = p_organization_id
    and (p_hostel_id is null or d.hostel_id = p_hostel_id)
    and d.document_type = 'payment_receipt'::public.document_type_enum
    and d.status = 'verified'::public.document_status_enum
    and d.invoice_id is null
    and d.deleted_at is null
    and p.status = 'verified'::public.payment_status_enum
    and p.invoice_id is not null
    and p.deleted_at is null;

  if p_dry_run then
    return jsonb_build_object(
      'dryRun', true,
      'candidates', v_candidates,
      'documentsLinked', 0
    );
  end if;

  update public.documents d
  set invoice_id = p.invoice_id,
      updated_at = now(),
      updated_by = coalesce(p_actor_user_id, d.updated_by),
      metadata = coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
        'financial_repair_invoice_linked_at', now(),
        'financial_repair_payment_id', p.id,
        'financial_repair_action', 'repair_receipt_invoice_links'
      )
  from public.payments p
  where d.organization_id = p_organization_id
    and (p_hostel_id is null or d.hostel_id = p_hostel_id)
    and d.payment_id = p.id
    and d.document_type = 'payment_receipt'::public.document_type_enum
    and d.status = 'verified'::public.document_status_enum
    and d.invoice_id is null
    and d.deleted_at is null
    and p.status = 'verified'::public.payment_status_enum
    and p.invoice_id is not null
    and p.deleted_at is null;

  get diagnostics v_documents_linked = row_count;

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
    'financial_reconciliation',
    null,
    'financial_reconciliation.receipt_invoice_links_repaired',
    jsonb_build_object(
      'candidates', v_candidates,
      'documentsLinked', v_documents_linked
    ),
    p_actor_user_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'dryRun', false,
    'candidates', v_candidates,
    'documentsLinked', v_documents_linked
  );
end;
$$;

grant execute on function public.financial_reconciliation_counts(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_verified_payments_missing_receipts(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.repair_monthly_fee_invoices_atomic(uuid, uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.repair_advance_payment_invoices_atomic(uuid, uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.repair_receipt_invoice_links_atomic(uuid, uuid, uuid, boolean) to authenticated, service_role;
