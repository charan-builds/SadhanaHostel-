-- Admissions and vacancy management foundation.
-- Adds production-grade inquiry -> reservation -> joining workflows with
-- reservation-aware capacity tracking and atomic booking/conversion functions.

begin;

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.lead_source_enum as enum (
    'phone',
    'whatsapp',
    'website',
    'walk_in',
    'referral',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.lead_status_enum as enum (
    'new_inquiry',
    'called',
    'interested',
    'reserved',
    'confirmed',
    'cancelled',
    'joined'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.reservation_status_enum as enum (
    'pending',
    'reserved',
    'confirmed',
    'expired',
    'cancelled',
    'converted_to_resident'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.reservation_payment_status_enum as enum (
    'pending',
    'proof_uploaded',
    'verified',
    'rejected',
    'refunded',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.admission_activity_type_enum as enum (
    'lead_created',
    'lead_updated',
    'follow_up_scheduled',
    'note_added',
    'reservation_created',
    'reservation_confirmed',
    'reservation_cancelled',
    'reservation_expired',
    'advance_payment_uploaded',
    'advance_payment_verified',
    'advance_payment_rejected',
    'converted_to_resident'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Capacity and admissions tables
-- ---------------------------------------------------------------------------

create table if not exists public.hostel_capacity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  total_beds integer not null default 70 check (total_beds >= 0),
  occupied_beds integer not null default 0 check (occupied_beds >= 0),
  reserved_beds integer not null default 0 check (reserved_beds >= 0),
  maintenance_blocked_beds integer not null default 0 check (maintenance_blocked_beds >= 0),
  available_beds integer not null default 70 check (available_beds >= 0),
  last_calculated_at timestamptz not null default now(),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint hostel_capacity_unique unique (organization_id, hostel_id),
  constraint hostel_capacity_non_negative_available check (
    total_beds >= occupied_beds + reserved_beds + maintenance_blocked_beds
  )
);

create table if not exists public.room_capacity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  total_beds integer not null check (total_beds >= 0),
  occupied_beds integer not null default 0 check (occupied_beds >= 0),
  reserved_beds integer not null default 0 check (reserved_beds >= 0),
  maintenance_blocked_beds integer not null default 0 check (maintenance_blocked_beds >= 0),
  available_beds integer not null default 0 check (available_beds >= 0),
  last_calculated_at timestamptz not null default now(),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint room_capacity_unique unique (organization_id, room_id),
  constraint room_capacity_non_negative_available check (
    total_beds >= occupied_beds + reserved_beds + maintenance_blocked_beds
  )
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null,
  whatsapp_number text,
  email citext,
  resident_type public.resident_type_enum not null default 'student',
  desired_joining_date date,
  expected_stay_duration text,
  parent_name text,
  parent_phone text,
  notes text,
  source public.lead_source_enum not null default 'website',
  status public.lead_status_enum not null default 'new_inquiry',
  assigned_to uuid references public.users(id) on delete set null,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  cancelled_reason text,
  joined_resident_id uuid references public.residents(id) on delete set null,
  is_active boolean not null default true,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null
);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  note text not null check (length(trim(note)) > 0),
  is_pinned boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null
);

create table if not exists public.lead_activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid references public.hostels(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade,
  reservation_id uuid,
  activity_type public.admission_activity_type_enum not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  reserved_room_id uuid references public.rooms(id) on delete set null,
  reserved_bed_count integer not null default 1 check (reserved_bed_count > 0),
  reserved_until timestamptz not null,
  advance_amount numeric(12,2) not null default 0 check (advance_amount >= 0),
  status public.reservation_status_enum not null default 'reserved',
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  converted_at timestamptz,
  converted_resident_id uuid references public.residents(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint reservations_reserved_until_future_for_open check (
    status in ('expired', 'cancelled', 'converted_to_resident')
    or reserved_until > created_at
  )
);

create table if not exists public.reservation_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method_enum not null default 'upi',
  status public.reservation_payment_status_enum not null default 'pending',
  transaction_id text,
  proof_document_id uuid references public.documents(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  paid_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.users(id) on delete set null,
  rejection_reason text,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null
);

alter table public.lead_activity_logs
  drop constraint if exists lead_activity_logs_reservation_id_fkey;

alter table public.lead_activity_logs
  add constraint lead_activity_logs_reservation_id_fkey
  foreign key (reservation_id) references public.reservations(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists hostel_capacity_org_hostel_idx
  on public.hostel_capacity (organization_id, hostel_id);

create index if not exists room_capacity_org_hostel_room_idx
  on public.room_capacity (organization_id, hostel_id, room_id);

create index if not exists leads_org_status_followup_idx
  on public.leads (organization_id, hostel_id, status, next_follow_up_at)
  where deleted_at is null;

create index if not exists leads_phone_idx
  on public.leads (phone);

create index if not exists leads_source_created_idx
  on public.leads (organization_id, source, created_at desc);

create index if not exists lead_notes_lead_created_idx
  on public.lead_notes (lead_id, created_at desc);

create index if not exists lead_activity_logs_lead_created_idx
  on public.lead_activity_logs (lead_id, created_at desc);

create index if not exists reservations_org_status_expiry_idx
  on public.reservations (organization_id, hostel_id, status, reserved_until)
  where deleted_at is null;

create index if not exists reservations_room_status_idx
  on public.reservations (reserved_room_id, status, reserved_until)
  where deleted_at is null;

create index if not exists reservation_payments_reservation_idx
  on public.reservation_payments (reservation_id, status, created_at desc)
  where deleted_at is null;

create unique index if not exists reservation_payments_transaction_uidx
  on public.reservation_payments (organization_id, transaction_id)
  where transaction_id is not null and deleted_at is null;

create unique index if not exists reservations_one_open_per_lead_uidx
  on public.reservations (organization_id, lead_id)
  where status in ('pending', 'reserved', 'confirmed') and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Capacity views
-- ---------------------------------------------------------------------------

create or replace view public.room_vacancy_view as
select
  r.organization_id,
  r.hostel_id,
  r.id as room_id,
  r.room_number,
  r.room_name,
  r.room_type,
  r.status as room_status,
  coalesce(rc.total_beds, r.capacity) as total_beds,
  (
    select count(*)::integer
    from public.room_allocations ra
    where ra.room_id = r.id
      and ra.organization_id = r.organization_id
      and ra.status = 'active'
      and ra.deleted_at is null
  ) as occupied_beds,
  (
    select coalesce(sum(rv.reserved_bed_count), 0)::integer
    from public.reservations rv
    where rv.reserved_room_id = r.id
      and rv.organization_id = r.organization_id
      and rv.status in ('reserved', 'confirmed')
      and rv.reserved_until > now()
      and rv.deleted_at is null
  ) as reserved_beds,
  case
    when r.status = 'maintenance' then coalesce(rc.total_beds, r.capacity)
    else coalesce(rc.maintenance_blocked_beds, 0)
  end as maintenance_blocked_beds,
  greatest(
    coalesce(rc.total_beds, r.capacity)
    - (
      select count(*)::integer
      from public.room_allocations ra
      where ra.room_id = r.id
        and ra.organization_id = r.organization_id
        and ra.status = 'active'
        and ra.deleted_at is null
    )
    - (
      select coalesce(sum(rv.reserved_bed_count), 0)::integer
      from public.reservations rv
      where rv.reserved_room_id = r.id
        and rv.organization_id = r.organization_id
        and rv.status in ('reserved', 'confirmed')
        and rv.reserved_until > now()
        and rv.deleted_at is null
    )
    - case
        when r.status = 'maintenance' then coalesce(rc.total_beds, r.capacity)
        else coalesce(rc.maintenance_blocked_beds, 0)
      end,
    0
  ) as available_beds,
  now() as calculated_at
from public.rooms r
left join public.room_capacity rc
  on rc.room_id = r.id
 and rc.organization_id = r.organization_id
where r.deleted_at is null
  and r.is_active is true;

create or replace view public.hostel_vacancy_view as
select
  h.organization_id,
  h.id as hostel_id,
  h.name as hostel_name,
  coalesce(hc.total_beds, 70) as total_beds,
  coalesce(sum(rv.occupied_beds), 0)::integer as occupied_beds,
  (
    coalesce(sum(rv.reserved_beds), 0)
    + (
      select coalesce(sum(general.reserved_bed_count), 0)
      from public.reservations general
      where general.organization_id = h.organization_id
        and general.hostel_id = h.id
        and general.reserved_room_id is null
        and general.status in ('reserved', 'confirmed')
        and general.reserved_until > now()
        and general.deleted_at is null
    )
  )::integer as reserved_beds,
  (
    coalesce(hc.maintenance_blocked_beds, 0)
    + coalesce(sum(rv.maintenance_blocked_beds), 0)
  )::integer as maintenance_blocked_beds,
  greatest(
    coalesce(hc.total_beds, 70)
    - coalesce(sum(rv.occupied_beds), 0)::integer
    - (
      coalesce(sum(rv.reserved_beds), 0)
      + (
        select coalesce(sum(general.reserved_bed_count), 0)
        from public.reservations general
        where general.organization_id = h.organization_id
          and general.hostel_id = h.id
          and general.reserved_room_id is null
          and general.status in ('reserved', 'confirmed')
          and general.reserved_until > now()
          and general.deleted_at is null
      )
    )::integer
    - (
      coalesce(hc.maintenance_blocked_beds, 0)
      + coalesce(sum(rv.maintenance_blocked_beds), 0)
    )::integer,
    0
  ) as available_beds,
  now() as calculated_at
from public.hostels h
left join public.hostel_capacity hc
  on hc.hostel_id = h.id
 and hc.organization_id = h.organization_id
left join public.room_vacancy_view rv
  on rv.hostel_id = h.id
 and rv.organization_id = h.organization_id
where h.deleted_at is null
  and h.is_active is true
group by h.organization_id, h.id, h.name, hc.total_beds, hc.maintenance_blocked_beds;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_hostel_capacity(
  p_organization_id uuid,
  p_hostel_id uuid
)
returns public.hostel_capacity
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_capacity public.hostel_capacity;
  v_summary record;
begin
  insert into public.hostel_capacity (organization_id, hostel_id, total_beds)
  values (p_organization_id, p_hostel_id, 70)
  on conflict (organization_id, hostel_id) do nothing;

  select *
  into v_summary
  from public.hostel_vacancy_view
  where organization_id = p_organization_id
    and hostel_id = p_hostel_id;

  update public.hostel_capacity
  set
    occupied_beds = coalesce(v_summary.occupied_beds, 0),
    reserved_beds = coalesce(v_summary.reserved_beds, 0),
    available_beds = coalesce(v_summary.available_beds, greatest(total_beds - maintenance_blocked_beds, 0)),
    last_calculated_at = now()
  where organization_id = p_organization_id
    and hostel_id = p_hostel_id
  returning * into v_capacity;

  return v_capacity;
end;
$$;

create or replace function public.create_reservation_atomic(
  p_organization_id uuid,
  p_hostel_id uuid,
  p_lead_id uuid,
  p_reserved_room_id uuid default null,
  p_reserved_bed_count integer default 1,
  p_reserved_until timestamptz default now() + interval '48 hours',
  p_advance_amount numeric default 0,
  p_notes text default null,
  p_actor_user_id uuid default null
)
returns public.reservations
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.leads;
  v_room public.rooms;
  v_hostel_available integer;
  v_room_available integer;
  v_reservation public.reservations;
begin
  if p_reserved_bed_count <= 0 then
    raise exception 'invalid_bed_count' using errcode = '23514';
  end if;

  if p_reserved_until <= now() then
    raise exception 'reservation_expiry_must_be_future' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':hostel:' || p_hostel_id::text || ':reservations', 0)
  );

  select *
  into v_lead
  from public.leads
  where id = p_lead_id
    and organization_id = p_organization_id
    and (hostel_id = p_hostel_id or hostel_id is null)
    and deleted_at is null
  for update;

  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;

  if v_lead.status in ('cancelled', 'joined') then
    raise exception 'lead_not_reservable' using errcode = '23514';
  end if;

  select available_beds
  into v_hostel_available
  from public.hostel_vacancy_view
  where organization_id = p_organization_id
    and hostel_id = p_hostel_id;

  if coalesce(v_hostel_available, 0) < p_reserved_bed_count then
    raise exception 'hostel_capacity_exceeded' using errcode = '23514';
  end if;

  if p_reserved_room_id is not null then
    select *
    into v_room
    from public.rooms
    where id = p_reserved_room_id
      and organization_id = p_organization_id
      and hostel_id = p_hostel_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'room_not_found' using errcode = 'P0002';
    end if;

    if v_room.status <> 'active' or v_room.is_active is not true then
      raise exception 'room_not_reservable' using errcode = '23514';
    end if;

    select available_beds
    into v_room_available
    from public.room_vacancy_view
    where room_id = p_reserved_room_id
      and organization_id = p_organization_id;

    if coalesce(v_room_available, 0) < p_reserved_bed_count then
      raise exception 'room_capacity_exceeded' using errcode = '23514';
    end if;
  end if;

  insert into public.reservations (
    organization_id,
    hostel_id,
    lead_id,
    reserved_room_id,
    reserved_bed_count,
    reserved_until,
    advance_amount,
    status,
    notes,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_lead_id,
    p_reserved_room_id,
    p_reserved_bed_count,
    p_reserved_until,
    coalesce(p_advance_amount, 0),
    'reserved',
    p_notes,
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_reservation;

  update public.leads
  set
    status = 'reserved',
    hostel_id = p_hostel_id,
    updated_by = p_actor_user_id
  where id = p_lead_id;

  insert into public.lead_activity_logs (
    organization_id,
    hostel_id,
    lead_id,
    reservation_id,
    activity_type,
    description,
    actor_user_id,
    created_by,
    updated_by,
    metadata
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_lead_id,
    v_reservation.id,
    'reservation_created',
    'Reservation created and beds held.',
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    jsonb_build_object('reserved_bed_count', p_reserved_bed_count)
  );

  perform public.recalculate_hostel_capacity(p_organization_id, p_hostel_id);

  return v_reservation;
end;
$$;

create or replace function public.verify_reservation_payment_atomic(
  p_organization_id uuid,
  p_payment_id uuid,
  p_actor_user_id uuid,
  p_notes text default null
)
returns public.reservation_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.reservation_payments;
begin
  select *
  into v_payment
  from public.reservation_payments
  where id = p_payment_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'reservation_payment_not_found' using errcode = 'P0002';
  end if;

  if v_payment.status = 'verified' then
    return v_payment;
  end if;

  if v_payment.proof_document_id is null and v_payment.method = 'upi' then
    raise exception 'payment_proof_required' using errcode = '23514';
  end if;

  update public.reservation_payments
  set
    status = 'verified',
    verified_at = now(),
    verified_by = p_actor_user_id,
    notes = coalesce(p_notes, notes),
    updated_by = p_actor_user_id
  where id = p_payment_id
  returning * into v_payment;

  update public.reservations
  set
    status = 'confirmed',
    confirmed_at = coalesce(confirmed_at, now()),
    updated_by = p_actor_user_id
  where id = v_payment.reservation_id
    and status in ('pending', 'reserved', 'confirmed');

  update public.leads
  set
    status = 'confirmed',
    updated_by = p_actor_user_id
  where id = v_payment.lead_id
    and status <> 'joined';

  insert into public.lead_activity_logs (
    organization_id,
    hostel_id,
    lead_id,
    reservation_id,
    activity_type,
    description,
    actor_user_id,
    created_by,
    updated_by,
    metadata
  )
  values (
    v_payment.organization_id,
    v_payment.hostel_id,
    v_payment.lead_id,
    v_payment.reservation_id,
    'advance_payment_verified',
    'Reservation advance payment verified.',
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    jsonb_build_object('payment_id', v_payment.id, 'amount', v_payment.amount)
  );

  return v_payment;
end;
$$;

create or replace function public.convert_reservation_to_resident_atomic(
  p_organization_id uuid,
  p_reservation_id uuid,
  p_joined_on date default current_date,
  p_monthly_fee_amount numeric default null,
  p_security_deposit_amount numeric default 0,
  p_actor_user_id uuid default null
)
returns public.residents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reservation public.reservations;
  v_lead public.leads;
  v_room public.rooms;
  v_resident public.residents;
  v_admission_number text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':reservation:' || p_reservation_id::text, 0)
  );

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.status not in ('reserved', 'confirmed') then
    raise exception 'reservation_not_convertible' using errcode = '23514';
  end if;

  select *
  into v_lead
  from public.leads
  where id = v_reservation.lead_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.reserved_room_id is not null then
    select *
    into v_room
    from public.rooms
    where id = v_reservation.reserved_room_id
      and organization_id = p_organization_id
      and hostel_id = v_reservation.hostel_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'room_not_found' using errcode = 'P0002';
    end if;
  end if;

  v_admission_number :=
    'ADM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(v_reservation.id::text, 1, 8));

  insert into public.residents (
    organization_id,
    hostel_id,
    admission_number,
    full_name,
    preferred_name,
    phone,
    email,
    resident_type,
    parent_name,
    parent_phone,
    emergency_contact_name,
    emergency_contact_phone,
    status,
    joined_on,
    monthly_fee_amount,
    security_deposit_amount,
    notes,
    created_by,
    updated_by,
    metadata
  )
  values (
    p_organization_id,
    v_reservation.hostel_id,
    v_admission_number,
    v_lead.full_name,
    split_part(v_lead.full_name, ' ', 1),
    v_lead.phone,
    v_lead.email::text,
    v_lead.resident_type,
    v_lead.parent_name,
    v_lead.parent_phone,
    v_lead.parent_name,
    v_lead.parent_phone,
    'active',
    coalesce(p_joined_on, current_date),
    coalesce(p_monthly_fee_amount, v_room.base_monthly_fee, 0),
    coalesce(p_security_deposit_amount, 0),
    v_reservation.notes,
    p_actor_user_id,
    p_actor_user_id,
    jsonb_build_object(
      'lead_id', v_lead.id,
      'reservation_id', v_reservation.id,
      'converted_from_admissions', true
    )
  )
  returning * into v_resident;

  update public.reservations
  set
    status = 'converted_to_resident',
    converted_at = now(),
    converted_resident_id = v_resident.id,
    updated_by = p_actor_user_id
  where id = v_reservation.id;

  if v_reservation.reserved_room_id is not null then
    perform public.allocate_room_atomic(
      p_organization_id,
      v_reservation.hostel_id,
      v_reservation.reserved_room_id,
      v_resident.id,
      null,
      coalesce(p_joined_on, current_date),
      null,
      coalesce(p_monthly_fee_amount, v_room.base_monthly_fee, 0),
      'Converted from reservation ' || v_reservation.id::text,
      p_actor_user_id
    );
  end if;

  update public.leads
  set
    status = 'joined',
    joined_resident_id = v_resident.id,
    updated_by = p_actor_user_id
  where id = v_lead.id;

  insert into public.lead_activity_logs (
    organization_id,
    hostel_id,
    lead_id,
    reservation_id,
    activity_type,
    description,
    actor_user_id,
    created_by,
    updated_by,
    metadata
  )
  values (
    p_organization_id,
    v_reservation.hostel_id,
    v_lead.id,
    v_reservation.id,
    'converted_to_resident',
    'Reservation converted into active resident.',
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    jsonb_build_object('resident_id', v_resident.id)
  );

  perform public.recalculate_hostel_capacity(p_organization_id, v_reservation.hostel_id);

  return v_resident;
end;
$$;

create or replace function public.expire_reservations(
  p_organization_id uuid default null,
  p_hostel_id uuid default null,
  p_limit integer default 200
)
returns table (
  expired_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  with candidates as (
    select r.id
    from public.reservations r
    where r.status in ('pending', 'reserved')
      and r.reserved_until <= now()
      and r.deleted_at is null
      and (p_organization_id is null or r.organization_id = p_organization_id)
      and (p_hostel_id is null or r.hostel_id = p_hostel_id)
    order by r.reserved_until asc
    limit greatest(coalesce(p_limit, 200), 1)
    for update skip locked
  ),
  expired as (
    update public.reservations r
    set
      status = 'expired',
      expired_at = now(),
      updated_at = now()
    from candidates c
    where r.id = c.id
    returning r.*
  ),
  lead_updates as (
    update public.leads l
    set status = 'interested', updated_at = now()
    from expired e
    where l.id = e.lead_id
      and l.status = 'reserved'
    returning l.id
  ),
  activity as (
    insert into public.lead_activity_logs (
      organization_id,
      hostel_id,
      lead_id,
      reservation_id,
      activity_type,
      description,
      metadata
    )
    select
      e.organization_id,
      e.hostel_id,
      e.lead_id,
      e.id,
      'reservation_expired',
      'Reservation expired automatically and beds were released.',
      jsonb_build_object('reserved_until', e.reserved_until)
    from expired e
    returning id
  )
  select count(*)::integer into v_count from expired;

  return query select coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'hostel_capacity',
    'room_capacity',
    'leads',
    'lead_notes',
    'lead_activity_logs',
    'reservations',
    'reservation_payments'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.hostel_capacity enable row level security;
alter table public.room_capacity enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_activity_logs enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_payments enable row level security;

drop policy if exists "hostel_capacity_admin_select" on public.hostel_capacity;
create policy "hostel_capacity_admin_select"
on public.hostel_capacity
for select
to authenticated
using (public.belongs_to_organization(organization_id));

drop policy if exists "hostel_capacity_admin_write" on public.hostel_capacity;
create policy "hostel_capacity_admin_write"
on public.hostel_capacity
for all
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "room_capacity_admin_select" on public.room_capacity;
create policy "room_capacity_admin_select"
on public.room_capacity
for select
to authenticated
using (public.belongs_to_organization(organization_id));

drop policy if exists "room_capacity_admin_write" on public.room_capacity;
create policy "room_capacity_admin_write"
on public.room_capacity
for all
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "leads_admin_select" on public.leads;
create policy "leads_admin_select"
on public.leads
for select
to authenticated
using (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "leads_admin_insert" on public.leads;
create policy "leads_admin_insert"
on public.leads
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "leads_admin_update" on public.leads;
create policy "leads_admin_update"
on public.leads
for update
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "lead_notes_admin_all" on public.lead_notes;
create policy "lead_notes_admin_all"
on public.lead_notes
for all
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "lead_activity_logs_admin_select" on public.lead_activity_logs;
create policy "lead_activity_logs_admin_select"
on public.lead_activity_logs
for select
to authenticated
using (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "lead_activity_logs_admin_insert" on public.lead_activity_logs;
create policy "lead_activity_logs_admin_insert"
on public.lead_activity_logs
for insert
to authenticated
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "reservations_admin_all" on public.reservations;
create policy "reservations_admin_all"
on public.reservations
for all
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

drop policy if exists "reservation_payments_admin_all" on public.reservation_payments;
create policy "reservation_payments_admin_all"
on public.reservation_payments
for all
to authenticated
using (public.can_manage_organization(organization_id, hostel_id))
with check (public.can_manage_organization(organization_id, hostel_id));

-- ---------------------------------------------------------------------------
-- Grants and default seed
-- ---------------------------------------------------------------------------

grant select on public.hostel_vacancy_view to anon, authenticated, service_role;
grant select on public.room_vacancy_view to authenticated, service_role;
grant execute on function public.recalculate_hostel_capacity(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_reservation_atomic(uuid, uuid, uuid, uuid, integer, timestamptz, numeric, text, uuid) to authenticated, service_role;
grant execute on function public.verify_reservation_payment_atomic(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.convert_reservation_to_resident_atomic(uuid, uuid, date, numeric, numeric, uuid) to authenticated, service_role;
grant execute on function public.expire_reservations(uuid, uuid, integer) to authenticated, service_role;

insert into public.hostel_capacity (organization_id, hostel_id, total_beds, notes)
select o.id, h.id, 70, 'Default operational capacity for Sadhana Boys Hostel.'
from public.organizations o
join public.hostels h on h.organization_id = o.id and h.code = 'SBH-MAIN'
where o.slug = 'sadhana-boys-hostel'
on conflict (organization_id, hostel_id) do update
set total_beds = excluded.total_beds,
    notes = excluded.notes;

insert into public.room_capacity (organization_id, hostel_id, room_id, total_beds)
select r.organization_id, r.hostel_id, r.id, r.capacity
from public.rooms r
where r.deleted_at is null
on conflict (organization_id, room_id) do update
set total_beds = excluded.total_beds;

commit;
