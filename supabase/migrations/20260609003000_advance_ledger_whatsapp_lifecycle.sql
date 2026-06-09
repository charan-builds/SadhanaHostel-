-- Advance ledger, resident lifecycle intelligence, and WhatsApp automation queues.

create table if not exists public.advance_payment_deposits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid not null references public.residents(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  amount numeric(12,2) not null,
  payment_mode public.payment_method_enum not null,
  transaction_id text,
  received_date date not null default current_date,
  received_by uuid references public.users(id) on delete set null,
  notes text,
  status text not null default 'received'
    check (status in ('received', 'voided')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint advance_payment_deposits_amount_chk check (amount > 0),
  constraint advance_payment_deposits_payment_unique unique (payment_id)
);

comment on table public.advance_payment_deposits is
  'Resident advance deposits. These rows are the liability source of truth and may be linked to verified advance payment receipts.';

create table if not exists public.advance_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid not null references public.residents(id) on delete restrict,
  deposit_id uuid references public.advance_payment_deposits(id) on delete set null,
  monthly_fee_record_id uuid not null references public.monthly_fee_records(id) on delete restrict,
  period_month date not null,
  amount numeric(12,2) not null,
  allocation_status text not null default 'applied'
    check (allocation_status in ('applied', 'reversed')),
  allocated_at timestamptz not null default now(),
  allocated_by uuid references public.users(id) on delete set null,
  reversal_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint advance_payment_allocations_amount_chk check (amount > 0),
  constraint advance_payment_allocations_month_chk check (
    period_month = date_trunc('month', period_month)::date
  )
);

comment on table public.advance_payment_allocations is
  'Advance liability consumption entries applied to monthly fee records.';

create table if not exists public.advance_payment_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid not null references public.hostels(id) on delete restrict,
  resident_id uuid not null references public.residents(id) on delete restrict,
  amount numeric(12,2) not null,
  reason text not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'paid', 'cancelled')),
  requested_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references public.users(id) on delete set null,
  paid_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint advance_payment_refunds_amount_chk check (amount > 0)
);

comment on table public.advance_payment_refunds is
  'Refund requests and approved/paid refund liability movements for resident advance balances.';

create table if not exists public.advance_payment_refund_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete set null,
  resident_id uuid references public.residents(id) on delete set null,
  refund_id uuid not null references public.advance_payment_refunds(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  old_status text,
  new_status text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.advance_payment_refund_audit_logs is
  'Immutable audit trail for refund workflow actions.';

create index if not exists advance_deposits_tenant_resident_idx
  on public.advance_payment_deposits (organization_id, hostel_id, resident_id, received_date desc)
  where deleted_at is null;

create index if not exists advance_deposits_payment_idx
  on public.advance_payment_deposits (payment_id)
  where payment_id is not null and deleted_at is null;

create index if not exists advance_allocations_tenant_resident_idx
  on public.advance_payment_allocations (organization_id, hostel_id, resident_id, period_month)
  where deleted_at is null and allocation_status = 'applied';

create index if not exists advance_allocations_fee_record_idx
  on public.advance_payment_allocations (monthly_fee_record_id)
  where deleted_at is null and allocation_status = 'applied';

create index if not exists advance_refunds_tenant_resident_idx
  on public.advance_payment_refunds (organization_id, hostel_id, resident_id, created_at desc)
  where deleted_at is null;

create index if not exists advance_refund_audit_refund_idx
  on public.advance_payment_refund_audit_logs (refund_id, created_at desc);

drop trigger if exists set_advance_payment_deposits_updated_at on public.advance_payment_deposits;
create trigger set_advance_payment_deposits_updated_at
before update on public.advance_payment_deposits
for each row execute function public.set_updated_at();

drop trigger if exists set_advance_payment_allocations_updated_at on public.advance_payment_allocations;
create trigger set_advance_payment_allocations_updated_at
before update on public.advance_payment_allocations
for each row execute function public.set_updated_at();

drop trigger if exists set_advance_payment_refunds_updated_at on public.advance_payment_refunds;
create trigger set_advance_payment_refunds_updated_at
before update on public.advance_payment_refunds
for each row execute function public.set_updated_at();

create or replace view public.advance_balance_view as
with deposits as (
  select
    organization_id,
    hostel_id,
    resident_id,
    coalesce(sum(amount), 0)::numeric(12,2) as total_advance_received
  from public.advance_payment_deposits
  where deleted_at is null
    and status = 'received'
  group by organization_id, hostel_id, resident_id
),
allocations as (
  select
    organization_id,
    hostel_id,
    resident_id,
    coalesce(sum(amount), 0)::numeric(12,2) as total_advance_consumed
  from public.advance_payment_allocations
  where deleted_at is null
    and allocation_status = 'applied'
  group by organization_id, hostel_id, resident_id
),
refunds as (
  select
    organization_id,
    hostel_id,
    resident_id,
    coalesce(sum(amount), 0)::numeric(12,2) as total_advance_refunded
  from public.advance_payment_refunds
  where deleted_at is null
    and status in ('approved', 'paid')
  group by organization_id, hostel_id, resident_id
)
select
  coalesce(d.organization_id, a.organization_id, r.organization_id) as organization_id,
  coalesce(d.hostel_id, a.hostel_id, r.hostel_id) as hostel_id,
  coalesce(d.resident_id, a.resident_id, r.resident_id) as resident_id,
  coalesce(d.total_advance_received, 0)::numeric(12,2) as total_advance_received,
  coalesce(a.total_advance_consumed, 0)::numeric(12,2) as total_advance_consumed,
  coalesce(r.total_advance_refunded, 0)::numeric(12,2) as total_advance_refunded,
  greatest(
    0,
    coalesce(d.total_advance_received, 0)
      - coalesce(a.total_advance_consumed, 0)
      - coalesce(r.total_advance_refunded, 0)
  )::numeric(12,2) as remaining_advance_balance
from deposits d
full outer join allocations a
  on a.organization_id = d.organization_id
  and a.hostel_id = d.hostel_id
  and a.resident_id = d.resident_id
full outer join refunds r
  on r.organization_id = coalesce(d.organization_id, a.organization_id)
  and r.hostel_id = coalesce(d.hostel_id, a.hostel_id)
  and r.resident_id = coalesce(d.resident_id, a.resident_id);

alter table public.advance_payment_deposits enable row level security;
alter table public.advance_payment_deposits force row level security;
alter table public.advance_payment_allocations enable row level security;
alter table public.advance_payment_allocations force row level security;
alter table public.advance_payment_refunds enable row level security;
alter table public.advance_payment_refunds force row level security;
alter table public.advance_payment_refund_audit_logs enable row level security;
alter table public.advance_payment_refund_audit_logs force row level security;

revoke all on table public.advance_payment_deposits from public, anon;
revoke all on table public.advance_payment_allocations from public, anon;
revoke all on table public.advance_payment_refunds from public, anon;
revoke all on table public.advance_payment_refund_audit_logs from public, anon;
grant select, insert, update on table public.advance_payment_deposits to authenticated;
grant select, insert, update on table public.advance_payment_allocations to authenticated;
grant select, insert, update on table public.advance_payment_refunds to authenticated;
grant select, insert on table public.advance_payment_refund_audit_logs to authenticated;
grant all on table public.advance_payment_deposits to service_role;
grant all on table public.advance_payment_allocations to service_role;
grant all on table public.advance_payment_refunds to service_role;
grant all on table public.advance_payment_refund_audit_logs to service_role;

drop policy if exists advance_deposits_select_finance_or_resident on public.advance_payment_deposits;
create policy advance_deposits_select_finance_or_resident
  on public.advance_payment_deposits
  for select
  using (
    deleted_at is null
    and (
      public.can_manage_finance(organization_id, hostel_id)
      or exists (
        select 1 from public.residents r
        where r.id = resident_id
          and r.organization_id = organization_id
          and r.user_id = auth.uid()
          and r.deleted_at is null
      )
    )
  );

drop policy if exists advance_deposits_finance_insert on public.advance_payment_deposits;
create policy advance_deposits_finance_insert
  on public.advance_payment_deposits
  for insert
  with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists advance_deposits_finance_update on public.advance_payment_deposits;
create policy advance_deposits_finance_update
  on public.advance_payment_deposits
  for update
  using (deleted_at is null and public.can_manage_finance(organization_id, hostel_id))
  with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists advance_allocations_select_finance_or_resident on public.advance_payment_allocations;
create policy advance_allocations_select_finance_or_resident
  on public.advance_payment_allocations
  for select
  using (
    deleted_at is null
    and (
      public.can_manage_finance(organization_id, hostel_id)
      or exists (
        select 1 from public.residents r
        where r.id = resident_id
          and r.organization_id = organization_id
          and r.user_id = auth.uid()
          and r.deleted_at is null
      )
    )
  );

drop policy if exists advance_allocations_finance_insert on public.advance_payment_allocations;
create policy advance_allocations_finance_insert
  on public.advance_payment_allocations
  for insert
  with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists advance_allocations_finance_update on public.advance_payment_allocations;
create policy advance_allocations_finance_update
  on public.advance_payment_allocations
  for update
  using (deleted_at is null and public.can_manage_finance(organization_id, hostel_id))
  with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists advance_refunds_select_finance_or_resident on public.advance_payment_refunds;
create policy advance_refunds_select_finance_or_resident
  on public.advance_payment_refunds
  for select
  using (
    deleted_at is null
    and (
      public.can_manage_finance(organization_id, hostel_id)
      or exists (
        select 1 from public.residents r
        where r.id = resident_id
          and r.organization_id = organization_id
          and r.user_id = auth.uid()
          and r.deleted_at is null
      )
    )
  );

drop policy if exists advance_refunds_finance_insert on public.advance_payment_refunds;
create policy advance_refunds_finance_insert
  on public.advance_payment_refunds
  for insert
  with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists advance_refunds_finance_update on public.advance_payment_refunds;
create policy advance_refunds_finance_update
  on public.advance_payment_refunds
  for update
  using (deleted_at is null and public.can_manage_finance(organization_id, hostel_id))
  with check (public.can_manage_finance(organization_id, hostel_id));

drop policy if exists advance_refund_audit_select_finance_or_resident on public.advance_payment_refund_audit_logs;
create policy advance_refund_audit_select_finance_or_resident
  on public.advance_payment_refund_audit_logs
  for select
  using (
    public.can_manage_finance(organization_id, hostel_id)
    or exists (
      select 1 from public.residents r
      where r.id = resident_id
        and r.organization_id = organization_id
        and r.user_id = auth.uid()
        and r.deleted_at is null
    )
  );

drop policy if exists advance_refund_audit_finance_insert on public.advance_payment_refund_audit_logs;
create policy advance_refund_audit_finance_insert
  on public.advance_payment_refund_audit_logs
  for insert
  with check (public.can_manage_finance(organization_id, hostel_id));

create table if not exists public.whatsapp_message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete set null,
  event_key text not null,
  name text not null,
  body_template text not null,
  enabled boolean not null default true,
  version integer not null default 1,
  variables jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint whatsapp_templates_event_key_chk check (event_key ~ '^[a-z0-9_.-]+$'),
  constraint whatsapp_templates_version_chk check (version > 0)
);

create unique index if not exists whatsapp_templates_unique_version_idx
  on public.whatsapp_message_templates (
    organization_id,
    coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    event_key,
    version
  )
  where deleted_at is null;

create table if not exists public.whatsapp_message_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete set null,
  template_id uuid references public.whatsapp_message_templates(id) on delete set null,
  resident_id uuid references public.residents(id) on delete set null,
  recipient_user_id uuid references public.users(id) on delete set null,
  event_key text not null,
  recipient_phone text not null,
  rendered_message text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_for timestamptz not null default now(),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  provider text,
  provider_message_id text,
  failure_reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint whatsapp_queue_attempts_chk check (attempt_count >= 0 and max_attempts > 0)
);

create unique index if not exists whatsapp_queue_idempotency_idx
  on public.whatsapp_message_queue (organization_id, idempotency_key)
  where idempotency_key is not null and deleted_at is null;

create index if not exists whatsapp_queue_due_idx
  on public.whatsapp_message_queue (status, scheduled_for, next_attempt_at)
  where deleted_at is null;

create index if not exists whatsapp_queue_tenant_event_idx
  on public.whatsapp_message_queue (organization_id, hostel_id, event_key, created_at desc)
  where deleted_at is null;

create table if not exists public.whatsapp_delivery_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hostel_id uuid references public.hostels(id) on delete set null,
  queue_id uuid not null references public.whatsapp_message_queue(id) on delete cascade,
  status text not null,
  provider_message_id text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists whatsapp_delivery_events_queue_idx
  on public.whatsapp_delivery_events (queue_id, created_at desc);

drop trigger if exists set_whatsapp_message_templates_updated_at on public.whatsapp_message_templates;
create trigger set_whatsapp_message_templates_updated_at
before update on public.whatsapp_message_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_whatsapp_message_queue_updated_at on public.whatsapp_message_queue;
create trigger set_whatsapp_message_queue_updated_at
before update on public.whatsapp_message_queue
for each row execute function public.set_updated_at();

alter table public.whatsapp_message_templates enable row level security;
alter table public.whatsapp_message_templates force row level security;
alter table public.whatsapp_message_queue enable row level security;
alter table public.whatsapp_message_queue force row level security;
alter table public.whatsapp_delivery_events enable row level security;
alter table public.whatsapp_delivery_events force row level security;

revoke all on table public.whatsapp_message_templates from public, anon;
revoke all on table public.whatsapp_message_queue from public, anon;
revoke all on table public.whatsapp_delivery_events from public, anon;
grant select, insert, update on table public.whatsapp_message_templates to authenticated;
grant select, insert, update on table public.whatsapp_message_queue to authenticated;
grant select, insert on table public.whatsapp_delivery_events to authenticated;
grant all on table public.whatsapp_message_templates to service_role;
grant all on table public.whatsapp_message_queue to service_role;
grant all on table public.whatsapp_delivery_events to service_role;

drop policy if exists whatsapp_templates_admin_select on public.whatsapp_message_templates;
create policy whatsapp_templates_admin_select
  on public.whatsapp_message_templates
  for select
  using (
    deleted_at is null
    and (
      public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
      or public.can_manage_finance(organization_id, hostel_id)
    )
  );

drop policy if exists whatsapp_templates_admin_insert on public.whatsapp_message_templates;
create policy whatsapp_templates_admin_insert
  on public.whatsapp_message_templates
  for insert
  with check (
    public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
    or public.can_manage_finance(organization_id, hostel_id)
  );

drop policy if exists whatsapp_templates_admin_update on public.whatsapp_message_templates;
create policy whatsapp_templates_admin_update
  on public.whatsapp_message_templates
  for update
  using (
    deleted_at is null
    and (
      public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
      or public.can_manage_finance(organization_id, hostel_id)
    )
  )
  with check (
    public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
    or public.can_manage_finance(organization_id, hostel_id)
  );

drop policy if exists whatsapp_queue_admin_select on public.whatsapp_message_queue;
create policy whatsapp_queue_admin_select
  on public.whatsapp_message_queue
  for select
  using (
    deleted_at is null
    and (
      public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
      or public.can_manage_finance(organization_id, hostel_id)
    )
  );

drop policy if exists whatsapp_queue_admin_insert on public.whatsapp_message_queue;
create policy whatsapp_queue_admin_insert
  on public.whatsapp_message_queue
  for insert
  with check (
    public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
    or public.can_manage_finance(organization_id, hostel_id)
  );

drop policy if exists whatsapp_queue_admin_update on public.whatsapp_message_queue;
create policy whatsapp_queue_admin_update
  on public.whatsapp_message_queue
  for update
  using (
    deleted_at is null
    and (
      public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
      or public.can_manage_finance(organization_id, hostel_id)
    )
  )
  with check (
    public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
    or public.can_manage_finance(organization_id, hostel_id)
  );

drop policy if exists whatsapp_delivery_events_admin_select on public.whatsapp_delivery_events;
create policy whatsapp_delivery_events_admin_select
  on public.whatsapp_delivery_events
  for select
  using (
    public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
    or public.can_manage_finance(organization_id, hostel_id)
  );

drop policy if exists whatsapp_delivery_events_admin_insert on public.whatsapp_delivery_events;
create policy whatsapp_delivery_events_admin_insert
  on public.whatsapp_delivery_events
  for insert
  with check (
    public.has_permission_in_organization(organization_id, 'automation.manage', hostel_id)
    or public.can_manage_finance(organization_id, hostel_id)
  );
