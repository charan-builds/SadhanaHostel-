-- Materialize verified advance payments in the advance ledger immediately.

begin;

create or replace function public.sync_verified_advance_payment_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'verified'
     and new.is_advance is true
     and new.deleted_at is null then
    insert into public.advance_payment_deposits (
      organization_id,
      hostel_id,
      resident_id,
      payment_id,
      amount,
      payment_mode,
      transaction_id,
      received_date,
      received_by,
      notes,
      status,
      metadata,
      created_by,
      updated_by
    )
    values (
      new.organization_id,
      new.hostel_id,
      new.resident_id,
      new.id,
      new.amount,
      new.method,
      coalesce(new.transaction_id, new.manual_reference),
      coalesce(new.paid_at, new.verified_at, new.created_at)::date,
      coalesce(new.received_by, new.verified_by, new.created_by),
      new.notes,
      'received',
      jsonb_build_object(
        'source', 'verified_advance_payment_sync',
        'payment_id', new.id
      ),
      coalesce(new.created_by, new.received_by, new.verified_by),
      coalesce(new.updated_by, new.verified_by, new.received_by)
    )
    on conflict (payment_id)
    do update
    set amount = excluded.amount,
        payment_mode = excluded.payment_mode,
        transaction_id = excluded.transaction_id,
        received_date = excluded.received_date,
        received_by = excluded.received_by,
        notes = excluded.notes,
        status = 'received',
        metadata = public.advance_payment_deposits.metadata || excluded.metadata,
        updated_by = excluded.updated_by,
        updated_at = clock_timestamp();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_verified_advance_payment_deposit_trg
  on public.payments;

create trigger sync_verified_advance_payment_deposit_trg
after insert or update of status, amount, is_advance, deleted_at
on public.payments
for each row
execute function public.sync_verified_advance_payment_deposit();

insert into public.advance_payment_deposits (
  organization_id,
  hostel_id,
  resident_id,
  payment_id,
  amount,
  payment_mode,
  transaction_id,
  received_date,
  received_by,
  notes,
  status,
  metadata,
  created_by,
  updated_by
)
select
  p.organization_id,
  p.hostel_id,
  p.resident_id,
  p.id,
  p.amount,
  p.method,
  coalesce(p.transaction_id, p.manual_reference),
  coalesce(p.paid_at, p.verified_at, p.created_at)::date,
  coalesce(p.received_by, p.verified_by, p.created_by),
  p.notes,
  'received',
  jsonb_build_object(
    'source', 'verified_advance_payment_sync',
    'payment_id', p.id
  ),
  coalesce(p.created_by, p.received_by, p.verified_by),
  coalesce(p.updated_by, p.verified_by, p.received_by)
from public.payments p
where p.status = 'verified'
  and p.is_advance is true
  and p.deleted_at is null
on conflict (payment_id)
do update
set amount = excluded.amount,
    payment_mode = excluded.payment_mode,
    transaction_id = excluded.transaction_id,
    received_date = excluded.received_date,
    received_by = excluded.received_by,
    notes = excluded.notes,
    status = 'received',
    metadata = public.advance_payment_deposits.metadata || excluded.metadata,
    updated_by = excluded.updated_by,
    updated_at = clock_timestamp();

revoke execute on function public.sync_verified_advance_payment_deposit()
from public, anon, authenticated;

grant execute on function public.sync_verified_advance_payment_deposit()
to service_role;

commit;
