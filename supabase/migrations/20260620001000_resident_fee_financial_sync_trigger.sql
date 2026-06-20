-- Keep resident fee edits synchronized with the financial source of truth.

begin;

create or replace function public.sync_resident_monthly_fee_financial_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE'
     or new.monthly_fee_amount is not distinct from old.monthly_fee_amount
     or new.deleted_at is not null then
    return new;
  end if;

  with target_fee_records as (
    select
      mfr.id,
      mfr.organization_id,
      mfr.resident_id,
      round(mfr.total_amount, 2) as previous_total_amount,
      greatest(
        0,
        round(
          new.monthly_fee_amount
            + coalesce(mfr.penalty_amount, 0)
            + coalesce(mfr.adjustment_amount, 0)
            - coalesce(mfr.discount_amount, 0)
            - coalesce(mfr.advance_adjustment_amount, 0),
          2
        )
      ) as corrected_total_amount,
      exists (
        select 1
        from public.payments p
        where p.organization_id = mfr.organization_id
          and p.monthly_fee_record_id = mfr.id
          and p.resident_id = mfr.resident_id
          and p.status = 'verified'::public.payment_status_enum
          and p.is_advance is false
          and p.deleted_at is null
      ) as has_verified_fee_payment
    from public.monthly_fee_records mfr
    where mfr.organization_id = new.organization_id
      and mfr.resident_id = new.id
      and mfr.deleted_at is null
      and mfr.status <> 'cancelled'::public.fee_record_status_enum
      and (
        round(mfr.base_amount, 2) = round(old.monthly_fee_amount, 2)
        or coalesce((mfr.metadata ->> 'derived_from_resident_monthly_fee_amount')::boolean, false)
        or coalesce((mfr.metadata ->> 'generated_for_initial_collection')::boolean, false)
        or coalesce((mfr.metadata ->> 'opening_month_fee')::boolean, false)
      )
    for update
  ),
  updated_fee_records as (
    update public.monthly_fee_records mfr
    set base_amount = round(new.monthly_fee_amount, 2),
        total_amount = tfr.corrected_total_amount,
        paid_amount = case
          when tfr.has_verified_fee_payment then tfr.corrected_total_amount
          else least(mfr.paid_amount, tfr.corrected_total_amount)
        end,
        balance_amount = case
          when tfr.has_verified_fee_payment then 0
          else greatest(0, tfr.corrected_total_amount - least(mfr.paid_amount, tfr.corrected_total_amount))
        end,
        status = case
          when tfr.has_verified_fee_payment
            or least(mfr.paid_amount, tfr.corrected_total_amount) >= tfr.corrected_total_amount
            then 'paid'::public.fee_record_status_enum
          when least(mfr.paid_amount, tfr.corrected_total_amount) > 0
            then 'partial'::public.fee_record_status_enum
          when mfr.due_date < current_date
            then 'overdue'::public.fee_record_status_enum
          else 'pending'::public.fee_record_status_enum
        end,
        metadata = coalesce(mfr.metadata, '{}'::jsonb) || jsonb_build_object(
          'resident_fee_sync_applied', true,
          'resident_fee_sync_old_amount', round(old.monthly_fee_amount, 2),
          'resident_fee_sync_new_amount', round(new.monthly_fee_amount, 2),
          'resident_fee_sync_at', clock_timestamp()
        ),
        updated_by = coalesce(new.updated_by, old.updated_by),
        updated_at = clock_timestamp()
    from target_fee_records tfr
    where mfr.id = tfr.id
    returning
      mfr.id,
      mfr.organization_id,
      mfr.resident_id,
      tfr.previous_total_amount,
      mfr.total_amount,
      mfr.paid_amount,
      mfr.balance_amount,
      mfr.status
  ),
  updated_payments as (
    update public.payments p
    set amount = case
          when ufr.previous_total_amount > 0
            then round(p.amount * (ufr.total_amount / ufr.previous_total_amount), 2)
          else ufr.total_amount
        end,
        is_partial = false,
        metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
          'resident_fee_sync_applied', true,
          'resident_fee_sync_old_amount', p.amount,
          'resident_fee_sync_new_fee_amount', ufr.total_amount,
          'resident_fee_sync_at', clock_timestamp()
        ),
        updated_by = coalesce(new.updated_by, old.updated_by),
        updated_at = clock_timestamp()
    from updated_fee_records ufr
    where p.organization_id = ufr.organization_id
      and p.resident_id = ufr.resident_id
      and p.monthly_fee_record_id = ufr.id
      and p.is_advance is false
      and p.status = 'verified'::public.payment_status_enum
      and p.deleted_at is null
    returning p.id
  )
  update public.invoices i
  set subtotal_amount = ufr.total_amount,
      total_amount = ufr.total_amount,
      paid_amount = ufr.paid_amount,
      balance_amount = ufr.balance_amount,
      status = case
        when ufr.status = 'paid' then 'paid'::public.invoice_status_enum
        when ufr.paid_amount > 0 then 'partially_paid'::public.invoice_status_enum
        else 'issued'::public.invoice_status_enum
      end,
      metadata = coalesce(i.metadata, '{}'::jsonb) || jsonb_build_object(
        'resident_fee_sync_applied', true,
        'resident_fee_sync_old_amount', round(old.monthly_fee_amount, 2),
        'resident_fee_sync_new_amount', round(new.monthly_fee_amount, 2),
        'resident_fee_sync_at', clock_timestamp(),
        'pdf_regeneration_required', true
      ),
      updated_by = coalesce(new.updated_by, old.updated_by),
      updated_at = clock_timestamp()
  from updated_fee_records ufr
  where i.organization_id = ufr.organization_id
    and i.resident_id = ufr.resident_id
    and i.monthly_fee_record_id = ufr.id
    and i.deleted_at is null;

  return new;
end;
$$;

drop trigger if exists sync_resident_monthly_fee_financial_records_trg
  on public.residents;

create trigger sync_resident_monthly_fee_financial_records_trg
after update of monthly_fee_amount
on public.residents
for each row
execute function public.sync_resident_monthly_fee_financial_records();

revoke execute on function public.sync_resident_monthly_fee_financial_records()
from public, anon, authenticated;

grant execute on function public.sync_resident_monthly_fee_financial_records()
to service_role;

commit;
