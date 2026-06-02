-- Keep payment-only enum checks out of the shared finance protection trigger.
-- The trigger is attached to payments, monthly_fee_records, and invoices; comparing
-- OLD.status to payment_status_enum on fee/invoice rows causes enum operator errors.

create or replace function public.protect_financial_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_context() then
    return new;
  end if;

  if tg_table_schema = 'public' and tg_table_name = 'payments' then
    if old.status = 'initiated'::public.payment_status_enum
       and new.status = 'pending'::public.payment_status_enum
       and old.organization_id = new.organization_id
       and old.hostel_id = new.hostel_id
       and old.resident_id = new.resident_id
       and old.amount = new.amount
       and old.method = new.method
       and old.transaction_id is not distinct from new.transaction_id
       and old.monthly_fee_record_id is not distinct from new.monthly_fee_record_id
       and old.invoice_id is not distinct from new.invoice_id
       and public.owns_resident(old.resident_id) then
      return new;
    end if;
  end if;

  if not public.can_manage_finance(old.organization_id, old.hostel_id) then
    raise exception 'Only finance admins can update financial records';
  end if;

  return new;
end;
$$;
