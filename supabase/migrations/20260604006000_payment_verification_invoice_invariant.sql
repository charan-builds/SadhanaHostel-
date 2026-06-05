-- Payment verification hardening:
-- verified payments must have invoice truth before the verified state is written.

create index if not exists payments_verified_missing_invoice_audit_idx
  on public.payments (organization_id, hostel_id, verified_at desc)
  where status = 'verified'::public.payment_status_enum
    and invoice_id is null
    and deleted_at is null;

alter table public.payments
  drop constraint if exists payments_verified_invoice_required_chk;

alter table public.payments
  add constraint payments_verified_invoice_required_chk
  check (
    status <> 'verified'::public.payment_status_enum
    or invoice_id is not null
  ) not valid;

create or replace function public.verify_payment_atomic(
  p_payment_id uuid,
  p_organization_id uuid,
  p_verifier_user_id uuid,
  p_idempotency_key text default null
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_invoice public.invoices;
  v_existing_invoice public.invoices;
  v_organization public.organizations;
  v_issue_day date;
  v_issue_month text;
  v_sequence integer;
  v_prefix text;
  v_invoice_number text;
begin
  if p_verifier_user_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and p_verifier_user_id is distinct from auth.uid() then
    raise exception 'payment_verifier_actor_mismatch' using errcode = '42501';
  end if;

  select p.*
  into v_payment
  from public.payments p
  where p.id = p_payment_id
    and p.organization_id = p_organization_id
    and p.deleted_at is null
  for update;

  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if not public.can_manage_finance(v_payment.organization_id, v_payment.hostel_id) then
    raise exception 'payment_verification_forbidden' using errcode = '42501';
  end if;

  if v_payment.status = 'verified'::public.payment_status_enum then
    if p_idempotency_key is null
       or v_payment.metadata ->> 'verification_idempotency_key' <> p_idempotency_key then
      raise exception 'payment_already_verified' using errcode = '23505';
    end if;
  else
    if v_payment.status = 'initiated'::public.payment_status_enum then
      raise exception 'payment_proof_submission_not_finalized' using errcode = '23514';
    end if;

    if v_payment.status <> 'pending'::public.payment_status_enum then
      raise exception 'payment_status_not_verifiable' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.documents d
      where d.organization_id = p_organization_id
        and d.payment_id = p_payment_id
        and d.resident_id = v_payment.resident_id
        and d.document_type = 'payment_receipt'::public.document_type_enum
        and d.status <> 'rejected'::public.document_status_enum
        and d.deleted_at is null
    ) then
      raise exception 'payment_proof_required' using errcode = '23514';
    end if;
  end if;

  if v_payment.invoice_id is null and v_payment.monthly_fee_record_id is not null then
    v_invoice := public.create_monthly_fee_invoice_atomic(
      p_organization_id,
      v_payment.monthly_fee_record_id,
      p_verifier_user_id
    );
    v_payment.invoice_id := v_invoice.id;
  end if;

  if v_payment.invoice_id is null and v_payment.monthly_fee_record_id is null then
    perform pg_advisory_xact_lock(
      hashtextextended(v_payment.organization_id::text || ':payment-receipt:' || v_payment.id::text, 0)
    );

    select i.*
    into v_existing_invoice
    from public.invoices i
    where i.organization_id = v_payment.organization_id
      and i.deleted_at is null
      and i.monthly_fee_record_id is null
      and i.metadata->>'source' = 'payment_receipt'
      and i.metadata->>'payment_id' = v_payment.id::text
    for update;

    if found then
      v_payment.invoice_id := v_existing_invoice.id;
    else
      select o.*
      into v_organization
      from public.organizations o
      where o.id = v_payment.organization_id
        and o.deleted_at is null
      for update;

      if not found then
        raise exception 'organization_not_found' using errcode = 'P0002';
      end if;

      v_issue_day := coalesce(v_payment.paid_at, v_payment.verified_at, v_payment.created_at, now())::date;
      v_issue_month := to_char(v_issue_day, 'YYYYMM');

      perform pg_advisory_xact_lock(
        hashtextextended(v_payment.organization_id::text || ':invoice:' || v_issue_month, 0)
      );

      select count(*)::integer + 1
      into v_sequence
      from public.invoices
      where organization_id = v_payment.organization_id
        and issue_date >= date_trunc('month', v_issue_day)::date
        and issue_date < (date_trunc('month', v_issue_day)::date + interval '1 month')
        and deleted_at is null;

      v_prefix := left(
        regexp_replace(
          regexp_replace(
            upper(regexp_replace(trim(coalesce(v_organization.slug, 'SBH')), '[^A-Za-z0-9]+', '-', 'g')),
            '^-+',
            ''
          ),
          '-+$',
          ''
        ),
        12
      );
      v_prefix := coalesce(nullif(v_prefix, ''), 'SBH');
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
        v_payment.organization_id,
        v_payment.hostel_id,
        v_payment.resident_id,
        null,
        v_invoice_number,
        'paid'::public.invoice_status_enum,
        v_issue_day,
        v_issue_day,
        v_payment.amount,
        0,
        0,
        v_payment.amount,
        v_payment.amount,
        0,
        jsonb_build_object(
          'organization_id', v_payment.organization_id,
          'hostel_id', v_payment.hostel_id,
          'resident_id', v_payment.resident_id,
          'source', 'payment_receipt',
          'payment_id', v_payment.id,
          'payment_method', v_payment.method,
          'transaction_id', v_payment.transaction_id,
          'manual_reference', v_payment.manual_reference,
          'is_advance', v_payment.is_advance,
          'generated_atomically_at', now(),
          'generated_by_user_id', p_verifier_user_id
        ),
        p_verifier_user_id,
        p_verifier_user_id
      )
      returning * into v_invoice;

      v_payment.invoice_id := v_invoice.id;
    end if;
  end if;

  if v_payment.invoice_id is null then
    raise exception 'verified_payment_requires_invoice' using errcode = '23514';
  end if;

  if v_payment.status = 'verified'::public.payment_status_enum then
    update public.payments p
    set
      invoice_id = v_payment.invoice_id,
      updated_by = p_verifier_user_id,
      updated_at = now(),
      metadata = p.metadata || jsonb_build_object(
        'verification_idempotency_key', p_idempotency_key,
        'invoice_repaired_during_idempotent_verification_at', now()
      )
    where p.id = p_payment_id
      and p.organization_id = p_organization_id
    returning * into v_payment;

    return v_payment;
  end if;

  update public.payments p
  set
    invoice_id = v_payment.invoice_id,
    status = 'verified'::public.payment_status_enum,
    verified_at = now(),
    paid_at = coalesce(p.paid_at, now()),
    verified_by = p_verifier_user_id,
    updated_by = p_verifier_user_id,
    lock_version = p.lock_version + 1,
    metadata = p.metadata || jsonb_build_object(
      'verification_idempotency_key', p_idempotency_key,
      'verified_atomically_at', now(),
      'invoice_id_at_verification', v_payment.invoice_id
    )
  where p.id = p_payment_id
    and p.organization_id = p_organization_id
  returning * into v_payment;

  if v_payment.monthly_fee_record_id is not null then
    update public.monthly_fee_records mfr
    set
      paid_amount = least(mfr.total_amount, mfr.paid_amount + v_payment.amount),
      balance_amount = greatest(0, mfr.total_amount - (mfr.paid_amount + v_payment.amount)),
      status = case
        when greatest(0, mfr.total_amount - (mfr.paid_amount + v_payment.amount)) = 0 then 'paid'::public.fee_record_status_enum
        when mfr.paid_amount + v_payment.amount > 0 then 'partial'::public.fee_record_status_enum
        else mfr.status
      end,
      updated_by = p_verifier_user_id,
      updated_at = now()
    where mfr.id = v_payment.monthly_fee_record_id
      and mfr.organization_id = p_organization_id
      and mfr.deleted_at is null;
  end if;

  update public.invoices i
  set
    paid_amount = least(i.total_amount, i.paid_amount + v_payment.amount),
    balance_amount = greatest(0, i.total_amount - (i.paid_amount + v_payment.amount)),
    status = case
      when greatest(0, i.total_amount - (i.paid_amount + v_payment.amount)) = 0 then 'paid'::public.invoice_status_enum
      when i.paid_amount + v_payment.amount > 0 then 'partially_paid'::public.invoice_status_enum
      else i.status
    end,
    updated_by = p_verifier_user_id,
    updated_at = now()
  where i.id = v_payment.invoice_id
    and i.organization_id = p_organization_id
    and i.deleted_at is null;

  return v_payment;
exception
  when unique_violation then
    select p.*
    into v_payment
    from public.payments p
    where p.id = p_payment_id
      and p.organization_id = p_organization_id
      and p.deleted_at is null;

    if v_payment.status = 'verified'::public.payment_status_enum
       and v_payment.invoice_id is not null
       and p_idempotency_key is not null
       and v_payment.metadata ->> 'verification_idempotency_key' = p_idempotency_key then
      return v_payment;
    end if;

    raise;
end;
$$;

revoke execute on function public.verify_payment_atomic(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.verify_payment_atomic(uuid, uuid, uuid, text)
  to authenticated, service_role;
