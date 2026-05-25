-- Quick resident admission hardening.
-- Draft/invited residents must be easy to create operationally. Strict phone
-- uniqueness is enforced only once a resident is active/suspended, while the
-- application layer can still surface friendly duplicate recovery actions.

drop index if exists public.residents_phone_active_uidx;

create unique index if not exists residents_phone_operational_uidx
  on public.residents (organization_id, phone)
  where phone is not null
    and deleted_at is null
    and is_active = true
    and status in ('active', 'suspended');

create unique index if not exists residents_email_operational_uidx
  on public.residents (organization_id, lower(email::text))
  where email is not null
    and deleted_at is null
    and is_active = true
    and status in ('active', 'suspended');

comment on index public.residents_phone_operational_uidx is
  'Prevents duplicate production resident phone numbers without blocking draft admissions.';

comment on index public.residents_email_operational_uidx is
  'Prevents duplicate production resident email addresses without blocking draft admissions.';
