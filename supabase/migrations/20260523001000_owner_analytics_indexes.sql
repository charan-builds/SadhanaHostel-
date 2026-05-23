-- Owner-grade analytics query support.
-- These indexes keep dashboard/report filters tenant-scoped and avoid full scans
-- as residents, payments, reservations, and fee records grow across hostels.

create index if not exists residents_owner_analytics_idx
  on public.residents (
    organization_id,
    hostel_id,
    status,
    onboarding_status,
    created_at,
    joined_on,
    checkout_on
  )
  where deleted_at is null;

create index if not exists room_allocations_owner_analytics_idx
  on public.room_allocations (
    organization_id,
    hostel_id,
    status,
    room_id,
    allocated_from,
    allocated_to
  )
  where deleted_at is null;

create index if not exists monthly_fee_records_owner_analytics_idx
  on public.monthly_fee_records (
    organization_id,
    hostel_id,
    period_month,
    due_date,
    status,
    resident_id
  )
  where deleted_at is null;

create index if not exists payments_owner_analytics_idx
  on public.payments (
    organization_id,
    hostel_id,
    status,
    created_at,
    verified_at,
    resident_id
  )
  where deleted_at is null;

create index if not exists reservations_owner_analytics_idx
  on public.reservations (
    organization_id,
    hostel_id,
    status,
    created_at,
    reserved_until
  )
  where deleted_at is null;

create index if not exists rooms_owner_analytics_idx
  on public.rooms (
    organization_id,
    hostel_id,
    status,
    room_number
  )
  where deleted_at is null;
