-- Collection Center follow-up fields for daily finance operations.

alter table public.collection_followups
  add column if not exists priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical'));

alter table public.collection_followups
  add column if not exists assigned_to uuid references public.users(id) on delete set null;

create index if not exists collection_followups_priority_idx
  on public.collection_followups (organization_id, hostel_id, priority, status, next_followup_at)
  where deleted_at is null;

create index if not exists collection_followups_assigned_to_idx
  on public.collection_followups (organization_id, assigned_to, status, next_followup_at)
  where deleted_at is null;
