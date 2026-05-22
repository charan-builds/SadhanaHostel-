-- Admin-driven operational control bootstrap.
-- Allows the first admin/owner/super-admin without an organization to create
-- the tenant, first hostel, default capacity, CMS placeholders, facilities, and
-- optional payment receiving configuration without opening Supabase.

begin;

create or replace function public.slugify_text(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(trim(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'item'
  );
$$;

create or replace function public.bootstrap_admin_tenant_atomic(
  p_organization_name text,
  p_organization_phone text default null,
  p_organization_email text default null,
  p_organization_address text default null,
  p_organization_city text default null,
  p_organization_state text default null,
  p_hostel_name text default null,
  p_hostel_phone text default null,
  p_hostel_email text default null,
  p_hostel_address text default null,
  p_hostel_city text default null,
  p_hostel_state text default null,
  p_hostel_capacity integer default 70,
  p_upi_id text default null,
  p_payment_account_name text default null,
  p_payment_instructions text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor public.users;
  v_organization public.organizations;
  v_hostel public.hostels;
  v_org_slug text;
  v_hostel_slug text;
  v_hostel_code text;
  v_can_bootstrap boolean := false;
begin
  if v_actor_id is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select *
  into v_actor
  from public.users
  where id = v_actor_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'user_profile_required' using errcode = 'P0002';
  end if;

  if v_actor.organization_id is not null then
    raise exception 'user_already_has_organization' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor_id
      and ur.organization_id is not null
      and ur.status = 'active'
      and ur.deleted_at is null
  ) then
    raise exception 'active_tenant_role_already_exists' using errcode = '23505';
  end if;

  v_can_bootstrap := v_actor.is_platform_user
    or v_actor.default_role in ('super_admin', 'owner', 'admin');

  if not v_can_bootstrap then
    raise exception 'bootstrap_requires_admin_role' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_organization_name, '')), '') is null then
    raise exception 'organization_name_required' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_hostel_name, '')), '') is null then
    p_hostel_name := p_organization_name;
  end if;

  if coalesce(p_hostel_capacity, 0) < 0 then
    raise exception 'hostel_capacity_must_be_non_negative' using errcode = '23514';
  end if;

  v_org_slug := public.slugify_text(p_organization_name);
  while exists (
    select 1 from public.organizations where slug = v_org_slug and deleted_at is null
  ) loop
    v_org_slug := public.slugify_text(p_organization_name) || '-' || substr(gen_random_uuid()::text, 1, 6);
  end loop;

  v_hostel_slug := public.slugify_text(p_hostel_name);
  v_hostel_code := upper(substr(regexp_replace(v_hostel_slug, '[^a-z0-9]', '', 'g'), 1, 8));
  if v_hostel_code = '' then
    v_hostel_code := 'HOSTEL';
  end if;

  insert into public.organizations (
    name,
    legal_name,
    slug,
    billing_email,
    contact_phone,
    address_line1,
    city,
    state,
    settings,
    created_by,
    updated_by
  )
  values (
    trim(p_organization_name),
    trim(p_organization_name),
    v_org_slug,
    nullif(trim(coalesce(p_organization_email, '')), ''),
    nullif(trim(coalesce(p_organization_phone, '')), ''),
    nullif(trim(coalesce(p_organization_address, '')), ''),
    nullif(trim(coalesce(p_organization_city, '')), ''),
    nullif(trim(coalesce(p_organization_state, '')), ''),
    jsonb_build_object(
      'bootstrap_source', 'admin_setup_wizard',
      'timezone', 'Asia/Kolkata',
      'branding', jsonb_build_object('short_name', trim(p_organization_name))
    ),
    v_actor_id,
    v_actor_id
  )
  returning * into v_organization;

  insert into public.hostels (
    organization_id,
    name,
    code,
    slug,
    phone,
    email,
    address_line1,
    city,
    state,
    capacity,
    settings,
    created_by,
    updated_by
  )
  values (
    v_organization.id,
    trim(p_hostel_name),
    v_hostel_code,
    v_hostel_slug,
    nullif(trim(coalesce(p_hostel_phone, '')), ''),
    nullif(trim(coalesce(p_hostel_email, '')), ''),
    nullif(trim(coalesce(p_hostel_address, '')), ''),
    nullif(trim(coalesce(p_hostel_city, '')), ''),
    nullif(trim(coalesce(p_hostel_state, '')), ''),
    coalesce(p_hostel_capacity, 70),
    jsonb_build_object(
      'hostel_type', 'boys_hostel',
      'setup_status', 'created_from_admin_wizard'
    ),
    v_actor_id,
    v_actor_id
  )
  returning * into v_hostel;

  update public.users
  set
    organization_id = v_organization.id,
    default_role = case
      when default_role = 'super_admin' then default_role
      else 'owner'::public.user_role_enum
    end,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_actor_id;

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
    v_organization.id,
    null,
    v_actor_id,
    'owner'::public.user_role_enum,
    '["organization.manage","hostel.manage","finance.manage","cms.manage","staff.manage"]'::jsonb,
    'active',
    now(),
    v_actor_id,
    v_actor_id
  );

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
    v_organization.id,
    v_hostel.id,
    v_actor_id,
    'owner'::public.user_role_enum,
    '["hostel.manage","finance.manage","cms.manage","resident.manage","admissions.manage"]'::jsonb,
    'active',
    now(),
    v_actor_id,
    v_actor_id
  );

  insert into public.hostel_capacity (
    organization_id,
    hostel_id,
    total_beds,
    notes,
    created_by,
    updated_by
  )
  values (
    v_organization.id,
    v_hostel.id,
    coalesce(p_hostel_capacity, 70),
    'Initial capacity created from admin setup wizard.',
    v_actor_id,
    v_actor_id
  )
  on conflict (organization_id, hostel_id) do update
  set
    total_beds = excluded.total_beds,
    updated_by = v_actor_id,
    updated_at = now();

  insert into public.website_settings (
    organization_id,
    hostel_id,
    section_key,
    title,
    content,
    status,
    seo_title,
    seo_description,
    created_by,
    updated_by
  )
  values
    (
      v_organization.id,
      v_hostel.id,
      'homepage',
      trim(p_hostel_name),
      jsonb_build_object(
        'heroTitle', trim(p_hostel_name),
        'heroSubtitle', 'Clean, safe, and well-managed hostel accommodation.',
        'primaryCta', 'Check Availability'
      ),
      'published',
      trim(p_hostel_name) || ' | Hostel Accommodation',
      'Managed hostel accommodation with rooms, facilities, fees, and resident support.',
      v_actor_id,
      v_actor_id
    ),
    (
      v_organization.id,
      v_hostel.id,
      'contact',
      'Contact',
      jsonb_build_object(
        'phone', coalesce(p_hostel_phone, p_organization_phone),
        'email', coalesce(p_hostel_email, p_organization_email),
        'address', coalesce(p_hostel_address, p_organization_address),
        'city', coalesce(p_hostel_city, p_organization_city)
      ),
      'published',
      'Contact ' || trim(p_hostel_name),
      'Contact details and location for hostel inquiries.',
      v_actor_id,
      v_actor_id
    ),
    (
      v_organization.id,
      v_hostel.id,
      'pricing',
      'Pricing',
      jsonb_build_object(
        'note', 'Add room pricing from Admin > Rooms.',
        'currency', 'INR'
      ),
      'draft',
      'Rooms and Pricing',
      'Hostel room pricing and fee details.',
      v_actor_id,
      v_actor_id
    )
  on conflict (
    organization_id,
    (coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    section_key
  )
  where deleted_at is null
  do nothing;

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
    published_at,
    created_by,
    updated_by
  )
  values
    (v_organization.id, v_hostel.id, 'WiFi', 'wifi', 'Internet access for residents.', 'wifi', true, 10, 'published', now(), v_actor_id, v_actor_id),
    (v_organization.id, v_hostel.id, 'Food', 'food', 'Daily food facility for residents.', 'utensils', true, 20, 'published', now(), v_actor_id, v_actor_id),
    (v_organization.id, v_hostel.id, 'CCTV', 'cctv', 'Security monitoring in common areas.', 'camera', true, 30, 'published', now(), v_actor_id, v_actor_id),
    (v_organization.id, v_hostel.id, 'Water', 'water', 'Drinking water and daily-use water availability.', 'droplets', true, 40, 'published', now(), v_actor_id, v_actor_id)
  on conflict (
    organization_id,
    (coalesce(hostel_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    slug
  )
  where deleted_at is null
  do nothing;

  if nullif(trim(coalesce(p_upi_id, '')), '') is not null then
    insert into public.payment_settings (
      organization_id,
      hostel_id,
      payment_method,
      account_name,
      upi_id,
      is_active,
      supports_manual_verification,
      instructions,
      require_utr,
      require_screenshot,
      allow_partial_payment,
      allow_advance_payment,
      min_payment_amount,
      created_by,
      updated_by
    )
    values (
      v_organization.id,
      v_hostel.id,
      'upi'::public.payment_method_enum,
      coalesce(nullif(trim(p_payment_account_name), ''), trim(p_hostel_name)),
      lower(trim(p_upi_id)),
      true,
      true,
      coalesce(
        nullif(trim(p_payment_instructions), ''),
        'Scan the hostel QR or pay to the UPI ID, then upload UTR and screenshot for verification.'
      ),
      true,
      true,
      true,
      true,
      1,
      v_actor_id,
      v_actor_id
    );
  end if;

  insert into public.audit_logs (
    organization_id,
    hostel_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    new_values,
    metadata,
    created_by,
    updated_by
  )
  values (
    v_organization.id,
    v_hostel.id,
    v_actor_id,
    'organizations',
    v_organization.id,
    'tenant.bootstrap',
    to_jsonb(v_organization),
    jsonb_build_object('hostel_id', v_hostel.id, 'source', 'admin_setup_wizard'),
    v_actor_id,
    v_actor_id
  );

  return jsonb_build_object(
    'organization', to_jsonb(v_organization),
    'hostel', to_jsonb(v_hostel)
  );
end;
$$;

revoke execute on function public.bootstrap_admin_tenant_atomic(
  text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text, text
) from public, anon;
grant execute on function public.bootstrap_admin_tenant_atomic(
  text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text, text
) to authenticated, service_role;

commit;
