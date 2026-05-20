-- Sadhana Boys Hostel Platform
-- Production-safe seed and onboarding architecture.
--
-- Important:
-- - This migration never inserts into auth.users.
-- - Supabase Auth remains the source of authentication identities.
-- - public.users is synchronized from auth.users through secure helper functions.
-- - Admin roles are not granted from untrusted signup metadata.

begin;

-- ---------------------------------------------------------------------------
-- Security helper hardening
-- ---------------------------------------------------------------------------

create or replace function public.is_service_context()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
    or coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'supabase_admin');
$$;

comment on function public.is_service_context() is
  'Returns true only for privileged database sessions or service-role JWTs. Uses session_user because current_user is unsafe inside SECURITY DEFINER helpers.';

-- ---------------------------------------------------------------------------
-- Seed constants
-- ---------------------------------------------------------------------------

create or replace function public.get_default_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.organizations
  where slug = 'sadhana-boys-hostel'
    and deleted_at is null
  limit 1;
$$;

create or replace function public.get_default_hostel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select h.id
  from public.hostels h
  join public.organizations o on o.id = h.organization_id
  where o.slug = 'sadhana-boys-hostel'
    and h.code = 'SBH-MAIN'
    and h.deleted_at is null
    and o.deleted_at is null
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Auth synchronization and onboarding helpers
-- ---------------------------------------------------------------------------

create or replace function public.sync_auth_user(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_record record;
  display_name text;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if not (
    public.is_service_context()
    or public.is_super_admin()
    or target_user_id = public.get_current_user_id()
  ) then
    raise exception 'Not authorized to sync this auth user';
  end if;

  select
    au.id,
    au.email,
    au.phone,
    au.raw_user_meta_data
  into auth_record
  from auth.users au
  where au.id = target_user_id;

  if auth_record.id is null then
    raise exception 'Auth user % does not exist', target_user_id;
  end if;

  display_name := nullif(trim(coalesce(
    auth_record.raw_user_meta_data ->> 'full_name',
    auth_record.raw_user_meta_data ->> 'name',
    split_part(coalesce(auth_record.email, ''), '@', 1),
    coalesce(auth_record.phone, '')
  )), '');

  insert into public.users (
    id,
    full_name,
    email,
    phone,
    default_role,
    is_active,
    metadata
  )
  values (
    auth_record.id,
    coalesce(display_name, 'New User'),
    auth_record.email,
    auth_record.phone,
    'resident',
    true,
    jsonb_build_object(
      'source', 'auth_sync',
      'synced_at', now()
    )
  )
  on conflict (id) do update
  set
    full_name = coalesce(nullif(excluded.full_name, 'New User'), public.users.full_name),
    email = excluded.email,
    phone = excluded.phone,
    is_active = true,
    metadata = public.users.metadata || jsonb_build_object('last_auth_sync_at', now()),
    updated_at = now();

  return auth_record.id;
end;
$$;

comment on function public.sync_auth_user(uuid) is
  'Synchronizes a Supabase auth.users identity into public.users without creating auth users manually.';

create or replace function public.assign_default_role(
  target_user_id uuid,
  target_organization_id uuid,
  target_hostel_id uuid default null,
  target_role public.user_role_enum default 'resident',
  role_permissions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  role_id uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if target_organization_id is null then
    raise exception 'target_organization_id is required';
  end if;

  if target_role = 'super_admin' then
    if not (public.is_service_context() or public.is_super_admin()) then
      raise exception 'Only service context or super admins can assign super_admin';
    end if;
  elsif target_role in ('owner', 'admin', 'staff') then
    if not (
      public.is_service_context()
      or public.is_super_admin()
      or public.has_role_in_organization(
        target_organization_id,
        array['owner', 'admin']::public.user_role_enum[],
        target_hostel_id
      )
    ) then
      raise exception 'Only organization owners/admins can assign staff or admin roles';
    end if;
  else
    if not (
      public.is_service_context()
      or public.is_super_admin()
      or public.can_manage_organization(target_organization_id, target_hostel_id)
    ) then
      raise exception 'Not authorized to assign this role';
    end if;
  end if;

  perform public.sync_auth_user(target_user_id);

  insert into public.user_roles (
    organization_id,
    hostel_id,
    user_id,
    role,
    permissions,
    status,
    accepted_at,
    created_by,
    updated_by
  )
  values (
    target_organization_id,
    target_hostel_id,
    target_user_id,
    target_role,
    coalesce(role_permissions, '[]'::jsonb),
    'active',
    now(),
    nullif(public.get_current_user_id(), target_user_id),
    nullif(public.get_current_user_id(), target_user_id)
  )
  on conflict (
    organization_id,
    coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    user_id,
    role
  )
  where deleted_at is null
  do update
  set
    permissions = excluded.permissions,
    status = 'active',
    accepted_at = coalesce(public.user_roles.accepted_at, now()),
    updated_at = now(),
    updated_by = excluded.updated_by
  returning id into role_id;

  update public.users
  set
    organization_id = coalesce(public.users.organization_id, target_organization_id),
    default_role = case
      when target_role in ('super_admin', 'owner', 'admin', 'staff') then target_role
      else public.users.default_role
    end,
    updated_at = now()
  where id = target_user_id;

  return role_id;
end;
$$;

comment on function public.assign_default_role(uuid, uuid, uuid, public.user_role_enum, jsonb) is
  'Assigns tenant-scoped roles safely. Admin escalation requires service context, super admin, or organization owner/admin.';

create or replace function public.onboard_resident(
  target_resident_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  resident_record public.residents%rowtype;
  auth_email citext;
  auth_phone text;
begin
  if target_resident_id is null or target_user_id is null then
    raise exception 'target_resident_id and target_user_id are required';
  end if;

  select *
  into resident_record
  from public.residents
  where id = target_resident_id
    and deleted_at is null;

  if resident_record.id is null then
    raise exception 'Resident % does not exist', target_resident_id;
  end if;

  perform public.sync_auth_user(target_user_id);

  select u.email, u.phone
  into auth_email, auth_phone
  from public.users u
  where u.id = target_user_id;

  if not (
    public.is_service_context()
    or public.can_manage_organization(resident_record.organization_id, resident_record.hostel_id)
  ) then
    if target_user_id <> public.get_current_user_id() then
      raise exception 'Not authorized to onboard this resident';
    end if;

    if not (
      (auth_email is not null and resident_record.email is not null and lower(auth_email::text) = lower(resident_record.email::text))
      or (auth_phone is not null and resident_record.phone is not null and auth_phone = resident_record.phone)
    ) then
      raise exception 'Resident invite does not match this auth identity';
    end if;
  end if;

  if resident_record.user_id is not null and resident_record.user_id <> target_user_id then
    raise exception 'Resident is already linked to another user';
  end if;

  update public.residents
  set
    user_id = target_user_id,
    status = case when status = 'draft' then 'active' else status end,
    updated_at = now(),
    updated_by = nullif(public.get_current_user_id(), target_user_id)
  where id = target_resident_id;

  update public.users
  set
    organization_id = resident_record.organization_id,
    default_role = 'resident',
    updated_at = now()
  where id = target_user_id;

  perform public.assign_default_role(
    target_user_id,
    resident_record.organization_id,
    resident_record.hostel_id,
    'resident',
    jsonb_build_array('resident.portal.access')
  );

  return target_resident_id;
end;
$$;

comment on function public.onboard_resident(uuid, uuid) is
  'Links an existing resident profile to a Supabase Auth user and grants resident portal access.';

create or replace function public.onboard_admin(
  target_user_id uuid,
  target_organization_id uuid,
  target_hostel_id uuid default null,
  target_role public.user_role_enum default 'admin'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  role_id uuid;
begin
  if target_role not in ('owner', 'admin', 'staff') then
    raise exception 'onboard_admin only supports owner, admin, or staff roles';
  end if;

  if target_organization_id is null then
    raise exception 'target_organization_id is required';
  end if;

  if not (
    public.is_service_context()
    or public.is_super_admin()
    or public.has_role_in_organization(
      target_organization_id,
      array['owner', 'admin']::public.user_role_enum[],
      target_hostel_id
    )
  ) then
    raise exception 'Not authorized to onboard admins for this organization';
  end if;

  perform public.sync_auth_user(target_user_id);

  role_id := public.assign_default_role(
    target_user_id,
    target_organization_id,
    target_hostel_id,
    target_role,
    case target_role
      when 'owner' then jsonb_build_array('organization.manage', 'finance.manage', 'cms.manage', 'roles.manage')
      when 'admin' then jsonb_build_array('residents.manage', 'rooms.manage', 'finance.manage', 'cms.manage', 'notices.manage')
      else jsonb_build_array('residents.read', 'rooms.read', 'leaves.manage', 'notices.manage')
    end
  );

  update public.users
  set
    organization_id = target_organization_id,
    default_role = target_role,
    is_active = true,
    updated_at = now()
  where id = target_user_id;

  return role_id;
end;
$$;

comment on function public.onboard_admin(uuid, uuid, uuid, public.user_role_enum) is
  'Grants owner/admin/staff access after Supabase Auth signup. Does not create auth.users.';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  candidate_resident_id uuid;
  candidate_resident public.residents%rowtype;
begin
  insert into public.users (
    id,
    full_name,
    email,
    phone,
    default_role,
    is_active,
    metadata
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      nullif(new.phone, ''),
      'New User'
    ),
    new.email,
    new.phone,
    'resident',
    true,
    jsonb_build_object(
      'source', 'auth_trigger',
      'synced_at', now()
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    phone = excluded.phone,
    metadata = public.users.metadata || jsonb_build_object('last_auth_trigger_sync_at', now()),
    updated_at = now();

  -- Safe resident self-activation path:
  -- Signup metadata may include resident_id from an invite link, but it is honored
  -- only when the auth email/phone matches the existing resident profile.
  candidate_resident_id := public.safe_uuid(new.raw_user_meta_data ->> 'resident_id');

  if candidate_resident_id is not null then
    select *
    into candidate_resident
    from public.residents r
    where r.id = candidate_resident_id
      and r.deleted_at is null
      and (r.user_id is null or r.user_id = new.id)
      and (
        (new.email is not null and r.email is not null and lower(r.email::text) = lower(new.email::text))
        or (new.phone is not null and r.phone is not null and r.phone = new.phone)
      );

    if candidate_resident.id is not null then
      perform public.onboard_resident(candidate_resident.id, new.id);
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Auth insert trigger that syncs auth.users to public.users and optionally activates a matching resident invite.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Optional manual sync function grants.
revoke all on function public.sync_auth_user(uuid) from public;
revoke all on function public.assign_default_role(uuid, uuid, uuid, public.user_role_enum, jsonb) from public;
revoke all on function public.onboard_resident(uuid, uuid) from public;
revoke all on function public.onboard_admin(uuid, uuid, uuid, public.user_role_enum) from public;

grant execute on function public.sync_auth_user(uuid) to authenticated, service_role;
grant execute on function public.assign_default_role(uuid, uuid, uuid, public.user_role_enum, jsonb) to authenticated, service_role;
grant execute on function public.onboard_resident(uuid, uuid) to authenticated, service_role;
grant execute on function public.onboard_admin(uuid, uuid, uuid, public.user_role_enum) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- First organization and hostel seed data
-- ---------------------------------------------------------------------------

insert into public.organizations (
  name,
  legal_name,
  slug,
  status,
  billing_email,
  contact_phone,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  country,
  settings,
  is_active
)
values (
  'Sadhana Boys Hostel',
  'Sadhana Boys Hostel',
  'sadhana-boys-hostel',
  'active',
  'admin@sadhanahostel.example',
  '+91 98765 43210',
  'Sadhana Boys Hostel, Main Road',
  'Near City Bus Stand',
  'Hyderabad',
  'Telangana',
  '500001',
  'IN',
  jsonb_build_object(
    'brand', jsonb_build_object(
      'short_name', 'Sadhana Hostel',
      'tagline', 'Safe, disciplined, and comfortable hostel living'
    ),
    'contact', jsonb_build_object(
      'phone', '+91 98765 43210',
      'whatsapp', '+91 98765 43210',
      'email', 'admin@sadhanahostel.example'
    ),
    'seo', jsonb_build_object(
      'title', 'Sadhana Boys Hostel Platform',
      'description', 'Modern hostel ERP and resident portal for Sadhana Boys Hostel.'
    ),
    'onboarding', jsonb_build_object(
      'mode', 'production_seed',
      'admin_creation', 'Supabase Auth signup followed by onboard_admin() from service role'
    )
  ),
  true
)
on conflict (slug)
where deleted_at is null
do update
set
  name = excluded.name,
  legal_name = excluded.legal_name,
  status = excluded.status,
  billing_email = excluded.billing_email,
  contact_phone = excluded.contact_phone,
  address_line1 = excluded.address_line1,
  address_line2 = excluded.address_line2,
  city = excluded.city,
  state = excluded.state,
  postal_code = excluded.postal_code,
  country = excluded.country,
  settings = public.organizations.settings || excluded.settings,
  is_active = true,
  updated_at = now();

insert into public.hostels (
  organization_id,
  name,
  code,
  slug,
  phone,
  email,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  capacity,
  settings,
  is_active
)
select
  o.id,
  'Sadhana Boys Hostel - Main Branch',
  'SBH-MAIN',
  'main-branch',
  '+91 98765 43210',
  'admin@sadhanahostel.example',
  'Sadhana Boys Hostel, Main Road',
  'Near City Bus Stand',
  'Hyderabad',
  'Telangana',
  '500001',
  120,
  jsonb_build_object(
    'hostel_type', 'boys_hostel',
    'occupancy', jsonb_build_object(
      'default_capacity', 120,
      'current_occupancy_seed', 0,
      'tracking_source', 'room_allocations'
    ),
    'rules', jsonb_build_object(
      'default_checkin_time', '09:00',
      'default_checkout_time', '18:00',
      'leave_approval_required', true
    )
  ),
  true
from public.organizations o
where o.slug = 'sadhana-boys-hostel'
on conflict (organization_id, code)
where deleted_at is null
do update
set
  name = excluded.name,
  slug = excluded.slug,
  phone = excluded.phone,
  email = excluded.email,
  address_line1 = excluded.address_line1,
  address_line2 = excluded.address_line2,
  city = excluded.city,
  state = excluded.state,
  postal_code = excluded.postal_code,
  capacity = excluded.capacity,
  settings = public.hostels.settings || excluded.settings,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Default website CMS content
-- ---------------------------------------------------------------------------

with seed_sections as (
  select *
  from (
    values
      (
        'homepage',
        'Homepage',
        jsonb_build_object(
          'hero_title', 'Sadhana Boys Hostel',
          'hero_subtitle', 'Safe, disciplined, and comfortable hostel living for students and working professionals.',
          'primary_cta', 'Contact Hostel',
          'secondary_cta', 'View Rooms',
          'highlights', jsonb_build_array('Clean rooms', 'Healthy food', 'WiFi', 'CCTV security')
        ),
        'Sadhana Boys Hostel | Safe Boys Hostel Accommodation',
        'Sadhana Boys Hostel provides safe, disciplined, and comfortable accommodation with food, WiFi, CCTV, and resident support.'
      ),
      (
        'about',
        'About Sadhana Boys Hostel',
        jsonb_build_object(
          'about_text', 'Sadhana Boys Hostel is built for residents who need a safe, organized, and supportive living environment.',
          'management_note', 'The hostel operations are supported by a modern ERP platform for residents, fees, leaves, and communication.',
          'values', jsonb_build_array('Safety', 'Discipline', 'Cleanliness', 'Transparency')
        ),
        'About Sadhana Boys Hostel',
        'Learn about Sadhana Boys Hostel, facilities, management, and resident-first hostel operations.'
      ),
      (
        'contact',
        'Contact Information',
        jsonb_build_object(
          'phone', '+91 98765 43210',
          'whatsapp', '+91 98765 43210',
          'email', 'admin@sadhanahostel.example',
          'address', 'Sadhana Boys Hostel, Main Road, Near City Bus Stand, Hyderabad, Telangana 500001',
          'map_link', 'https://maps.google.com/?q=Sadhana+Boys+Hostel'
        ),
        'Contact Sadhana Boys Hostel',
        'Contact Sadhana Boys Hostel for rooms, facilities, fees, and admission inquiries.'
      ),
      (
        'pricing',
        'Pricing and Fee Structure',
        jsonb_build_object(
          'currency', 'INR',
          'note', 'Pricing placeholders should be reviewed before publishing live website content.',
          'fee_structure', jsonb_build_array(
            jsonb_build_object('label', 'Student shared room', 'monthly_fee', 6500, 'deposit', 5000),
            jsonb_build_object('label', 'Employee shared room', 'monthly_fee', 8000, 'deposit', 8000),
            jsonb_build_object('label', 'Attached bathroom room', 'monthly_fee', 9500, 'deposit', 10000)
          )
        ),
        'Sadhana Boys Hostel Pricing',
        'View placeholder fee structure for Sadhana Boys Hostel rooms and facilities.'
      ),
      (
        'seo',
        'SEO Settings',
        jsonb_build_object(
          'site_name', 'Sadhana Boys Hostel',
          'default_title', 'Sadhana Boys Hostel Platform',
          'default_description', 'Hostel ERP, resident portal, room management, payments, leaves, notices, and CMS website.',
          'keywords', jsonb_build_array('boys hostel', 'student hostel', 'hostel management', 'Sadhana Boys Hostel')
        ),
        'Sadhana Boys Hostel Platform',
        'Production-grade hostel ERP and resident management platform.'
      ),
      (
        'terms',
        'Hostel Rules and Terms',
        jsonb_build_object(
          'payment_rules', 'Monthly fees must be paid by the due date. Late payment rules can be configured by admin.',
          'leave_policy', 'Residents must submit leave requests before leaving the hostel premises.',
          'conduct_rules', 'Residents must follow hostel discipline, safety, and cleanliness rules.'
        ),
        'Sadhana Boys Hostel Rules and Terms',
        'Hostel rules, payment terms, leave policy, and resident conduct guidelines.'
      )
  ) as section_data(section_key, title, content, seo_title, seo_description)
)
insert into public.website_settings (
  organization_id,
  hostel_id,
  section_key,
  title,
  content,
  status,
  seo_title,
  seo_description,
  published_at
)
select
  o.id,
  h.id,
  s.section_key,
  s.title,
  s.content,
  'published',
  s.seo_title,
  s.seo_description,
  now()
from seed_sections s
cross join public.organizations o
join public.hostels h on h.organization_id = o.id and h.code = 'SBH-MAIN'
where o.slug = 'sadhana-boys-hostel'
on conflict (
  organization_id,
  coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
  section_key
)
where deleted_at is null
do update
set
  title = excluded.title,
  content = excluded.content,
  status = excluded.status,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  published_at = coalesce(public.website_settings.published_at, now()),
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Default facilities
-- ---------------------------------------------------------------------------

with seed_facilities as (
  select *
  from (
    values
      ('WiFi', 'wifi', 'High-speed internet access for residents.', 'wifi', true, 10),
      ('Food', 'food', 'Daily food service with hostel meal planning.', 'utensils', true, 20),
      ('CCTV', 'cctv', 'CCTV monitoring in common and security-relevant areas.', 'camera', true, 30),
      ('Water', 'water', 'Clean drinking water and regular water availability.', 'droplets', true, 40),
      ('Parking', 'parking', 'Two-wheeler parking support subject to hostel rules.', 'parking-circle', false, 50),
      ('Hot Water', 'hot-water', 'Hot water facility availability based on hostel schedule.', 'thermometer-sun', true, 60),
      ('Security', 'security', 'Security-focused hostel operations and resident tracking.', 'shield-check', true, 70),
      ('Laundry', 'laundry', 'Laundry support can be configured by hostel management.', 'washing-machine', false, 80)
  ) as facility_data(name, slug, description, icon_name, is_highlighted, sort_order)
)
insert into public.facilities (
  organization_id,
  hostel_id,
  name,
  slug,
  description,
  icon_name,
  is_highlighted,
  sort_order,
  status,
  published_at
)
select
  o.id,
  h.id,
  f.name,
  f.slug,
  f.description,
  f.icon_name,
  f.is_highlighted,
  f.sort_order,
  'published',
  now()
from seed_facilities f
cross join public.organizations o
join public.hostels h on h.organization_id = o.id and h.code = 'SBH-MAIN'
where o.slug = 'sadhana-boys-hostel'
on conflict (
  organization_id,
  coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid),
  slug
)
where deleted_at is null
do update
set
  name = excluded.name,
  description = excluded.description,
  icon_name = excluded.icon_name,
  is_highlighted = excluded.is_highlighted,
  sort_order = excluded.sort_order,
  status = excluded.status,
  published_at = coalesce(public.facilities.published_at, now()),
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Default room configurations
-- ---------------------------------------------------------------------------

with seed_rooms as (
  select *
  from (
    values
      ('STU-101', 'Student Shared Room A', 'student_shared', '1', 'Student Block', 4, 6500::numeric(12,2), false, false, 'Shared student room without attached bathroom.'),
      ('STU-102', 'Student Shared Room B', 'student_shared', '1', 'Student Block', 4, 6500::numeric(12,2), false, false, 'Shared student room for standard occupancy.'),
      ('STU-201', 'Student Attached Bathroom Room', 'student_attached', '2', 'Student Block', 3, 9500::numeric(12,2), true, false, 'Student room with attached bathroom.'),
      ('EMP-101', 'Employee Shared Room', 'employee_shared', '1', 'Employee Block', 3, 8000::numeric(12,2), false, false, 'Shared room suitable for working professionals.'),
      ('EMP-201', 'Employee Premium Room', 'employee_premium', '2', 'Employee Block', 2, 11000::numeric(12,2), true, true, 'Premium employee room with attached bathroom and AC flag.')
  ) as room_data(room_number, room_name, room_type, floor, block_name, capacity, base_monthly_fee, has_attached_bathroom, has_ac, description)
)
insert into public.rooms (
  organization_id,
  hostel_id,
  room_number,
  room_name,
  room_type,
  floor,
  block_name,
  capacity,
  base_monthly_fee,
  has_attached_bathroom,
  has_ac,
  status,
  description,
  metadata,
  is_active
)
select
  o.id,
  h.id,
  r.room_number,
  r.room_name,
  r.room_type,
  r.floor,
  r.block_name,
  r.capacity,
  r.base_monthly_fee,
  r.has_attached_bathroom,
  r.has_ac,
  'active',
  r.description,
  jsonb_build_object(
    'seeded', true,
    'pricing_placeholder', true,
    'review_before_launch', true
  ),
  true
from seed_rooms r
cross join public.organizations o
join public.hostels h on h.organization_id = o.id and h.code = 'SBH-MAIN'
where o.slug = 'sadhana-boys-hostel'
on conflict (hostel_id, room_number)
where deleted_at is null
do update
set
  room_name = excluded.room_name,
  room_type = excluded.room_type,
  floor = excluded.floor,
  block_name = excluded.block_name,
  capacity = excluded.capacity,
  base_monthly_fee = excluded.base_monthly_fee,
  has_attached_bathroom = excluded.has_attached_bathroom,
  has_ac = excluded.has_ac,
  status = excluded.status,
  description = excluded.description,
  metadata = public.rooms.metadata || excluded.metadata,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Default onboarding notices
-- ---------------------------------------------------------------------------

insert into public.notices (
  organization_id,
  hostel_id,
  title,
  body,
  status,
  audience_type,
  audience_filter,
  is_pinned,
  published_at
)
select
  o.id,
  h.id,
  notice_data.title,
  notice_data.body,
  'published',
  'all',
  '{}'::jsonb,
  notice_data.is_pinned,
  now()
from (
  values
    (
      'Hostel Rules',
      'Residents are expected to maintain discipline, cleanliness, and respectful conduct inside the hostel premises.',
      true
    ),
    (
      'Payment Rules',
      'Monthly hostel fees must be paid by the configured due date. Online and offline payment workflows will be tracked in the resident portal.',
      true
    ),
    (
      'Leave Policy',
      'Residents must submit leave requests through the resident portal and wait for admin approval before leaving the hostel.',
      true
    )
) as notice_data(title, body, is_pinned)
cross join public.organizations o
join public.hostels h on h.organization_id = o.id and h.code = 'SBH-MAIN'
where o.slug = 'sadhana-boys-hostel'
  and not exists (
    select 1
    from public.notices n
    where n.organization_id = o.id
      and n.hostel_id = h.id
      and n.title = notice_data.title
      and n.deleted_at is null
  );

-- ---------------------------------------------------------------------------
-- Onboarding audit marker
-- ---------------------------------------------------------------------------

insert into public.audit_logs (
  organization_id,
  hostel_id,
  table_name,
  action,
  new_values,
  metadata
)
select
  o.id,
  h.id,
  'system_seed',
  'seed.initial_data_applied',
  jsonb_build_object(
    'organization_slug', o.slug,
    'hostel_code', h.code,
    'migration', '20260520002000_seed_initial_data'
  ),
  jsonb_build_object(
    'safe_auth_architecture', true,
    'manual_auth_user_insert', false,
    'admin_onboarding', 'Supabase Auth signup followed by onboard_admin() using service role or owner/admin'
  )
from public.organizations o
join public.hostels h on h.organization_id = o.id and h.code = 'SBH-MAIN'
where o.slug = 'sadhana-boys-hostel'
  and not exists (
    select 1
    from public.audit_logs al
    where al.organization_id = o.id
      and al.hostel_id = h.id
      and al.action = 'seed.initial_data_applied'
      and al.metadata ->> 'safe_auth_architecture' = 'true'
  );

commit;
