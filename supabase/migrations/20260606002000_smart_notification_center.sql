begin;

alter table public.notifications
  add column if not exists category text not null default 'personal'
    check (category in ('finance', 'hostel', 'personal')),
  add column if not exists priority text not null default 'info'
    check (priority in ('info', 'warning', 'urgent', 'critical')),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null;

update public.notifications
set
  category = case
    when template_key in (
      'payment_due_7_days',
      'payment_due_3_days',
      'payment_due_tomorrow',
      'payment_due_today',
      'payment_overdue',
      'payment_reminder',
      'payment_received',
      'payment_receipt',
      'receipt_generated',
      'invoice_generated'
    ) then 'finance'
    when notice_id is not null or template_key in (
      'notice_published',
      'maintenance_notice',
      'water_supply_notice',
      'electricity_notice',
      'emergency_announcement'
    ) then 'hostel'
    else 'personal'
  end,
  priority = case
    when template_key in ('emergency_announcement') then 'critical'
    when template_key in ('payment_overdue', 'password_reset', 'support.request.waiting_on_resident') then 'urgent'
    when template_key in (
      'payment_due_today',
      'payment_due_tomorrow',
      'payment_due_3_days',
      'payment_reminder',
      'leave_rejected',
      'leave_status_parent_notification'
    ) then 'warning'
    else 'info'
  end
where category = 'personal'
  and priority = 'info';

create index if not exists notifications_recipient_center_idx
  on public.notifications (
    organization_id,
    recipient_user_id,
    category,
    priority,
    created_at desc
  )
  where archived_at is null and deleted_at is null;

create index if not exists notifications_unread_center_idx
  on public.notifications (organization_id, recipient_user_id, created_at desc)
  where read_at is null and archived_at is null and deleted_at is null;

create index if not exists notifications_archived_idx
  on public.notifications (organization_id, recipient_user_id, archived_at desc)
  where archived_at is not null and deleted_at is null;

comment on column public.notifications.category is
  'Resident notification center category: finance, hostel, or personal.';

comment on column public.notifications.priority is
  'Resident notification center priority: info, warning, urgent, or critical.';

comment on column public.notifications.archived_at is
  'Per-recipient notification archive timestamp. Archived notifications are hidden from the center by default.';

commit;
