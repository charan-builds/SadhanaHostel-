-- Financial hardening: make payment invoice/PDF finalization durable and repairable.

do $$
begin
  create type public.invoice_finalization_status_enum as enum (
    'not_required',
    'pending',
    'in_progress',
    'succeeded',
    'failed'
  );
exception
  when duplicate_object then null;
end;
$$;

alter table public.payments
  add column if not exists invoice_finalization_status public.invoice_finalization_status_enum not null default 'not_required',
  add column if not exists invoice_finalization_attempts integer not null default 0,
  add column if not exists invoice_finalization_error text,
  add column if not exists invoice_finalized_at timestamptz,
  add constraint payments_invoice_finalization_attempts_chk
    check (invoice_finalization_attempts >= 0);

update public.payments p
set
  invoice_finalization_status = case
    when p.status <> 'verified' then 'not_required'::public.invoice_finalization_status_enum
    when p.invoice_id is not null
      and exists (
        select 1
        from public.invoices i
        where i.id = p.invoice_id
          and i.organization_id = p.organization_id
          and i.resident_id = p.resident_id
          and i.deleted_at is null
          and i.pdf_document_id is not null
      ) then 'succeeded'::public.invoice_finalization_status_enum
    else 'pending'::public.invoice_finalization_status_enum
  end,
  invoice_finalized_at = case
    when p.status = 'verified'
      and p.invoice_id is not null
      and exists (
        select 1
        from public.invoices i
        where i.id = p.invoice_id
          and i.organization_id = p.organization_id
          and i.resident_id = p.resident_id
          and i.deleted_at is null
          and i.pdf_document_id is not null
      ) then coalesce(p.invoice_finalized_at, p.verified_at, p.updated_at)
    else p.invoice_finalized_at
  end
where p.deleted_at is null;

create index if not exists payments_invoice_finalization_repair_idx
  on public.payments (organization_id, hostel_id, invoice_finalization_status, verified_at desc)
  where status = 'verified'
    and deleted_at is null
    and invoice_finalization_status <> 'succeeded';

create or replace function public.set_payment_invoice_finalization_pending()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'verified'::public.payment_status_enum
     and old.status is distinct from new.status
     and coalesce(new.invoice_finalization_status, 'not_required'::public.invoice_finalization_status_enum)
       in ('not_required'::public.invoice_finalization_status_enum, 'pending'::public.invoice_finalization_status_enum) then
    new.invoice_finalization_status := 'pending'::public.invoice_finalization_status_enum;
    new.invoice_finalization_error := null;
    new.invoice_finalized_at := null;
  end if;

  if new.status <> 'verified'::public.payment_status_enum then
    new.invoice_finalization_status := 'not_required'::public.invoice_finalization_status_enum;
    new.invoice_finalization_error := null;
    new.invoice_finalized_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_payment_invoice_finalization_pending on public.payments;
create trigger set_payment_invoice_finalization_pending
before update on public.payments
for each row
execute function public.set_payment_invoice_finalization_pending();
