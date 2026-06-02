-- Repair payment verification enum handling.
-- The previous function left some status references unqualified, which can make
-- PostgreSQL compare fee_record_status_enum with payment_status_enum during
-- monthly-fee updates.

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
begin
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

  if v_payment.status = 'verified'::public.payment_status_enum then
    if p_idempotency_key is not null
       and v_payment.metadata ->> 'verification_idempotency_key' = p_idempotency_key then
      return v_payment;
    end if;

    raise exception 'payment_already_verified' using errcode = '23505';
  end if;

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

  if v_payment.monthly_fee_record_id is not null and v_payment.invoice_id is null then
    v_invoice := public.create_monthly_fee_invoice_atomic(
      p_organization_id,
      v_payment.monthly_fee_record_id,
      p_verifier_user_id
    );
    v_payment.invoice_id := v_invoice.id;
  end if;

  update public.payments p
  set
    invoice_id = coalesce(v_payment.invoice_id, p.invoice_id),
    status = 'verified'::public.payment_status_enum,
    verified_at = now(),
    paid_at = coalesce(p.paid_at, now()),
    verified_by = p_verifier_user_id,
    updated_by = p_verifier_user_id,
    lock_version = p.lock_version + 1,
    metadata = p.metadata || jsonb_build_object(
      'verification_idempotency_key', p_idempotency_key,
      'verified_atomically_at', now()
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

  if v_payment.invoice_id is not null then
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
  end if;

  return v_payment;
end;
$$;

revoke execute on function public.verify_payment_atomic(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.verify_payment_atomic(uuid, uuid, uuid, text)
  to authenticated, service_role;
