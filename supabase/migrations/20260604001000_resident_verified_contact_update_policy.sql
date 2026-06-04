-- Allow verified residents to maintain safe contact fields from the resident portal.
-- Protected identity, finance, room, lifecycle, and deletion fields remain blocked by
-- the existing column-diff guard below.
create or replace function public.protect_resident_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_protected_changed boolean;
  v_self_allowed_changed boolean;
begin
  if current_setting('app.resident_activation_bootstrap', true) = 'true' then
    v_protected_changed := (
      to_jsonb(new)
        - 'user_id'
        - 'onboarding_status'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
        - 'search_vector'
    ) is distinct from (
      to_jsonb(old)
        - 'user_id'
        - 'onboarding_status'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
        - 'search_vector'
    );

    if new.deleted_at is not null then
      raise exception 'resident_activation_deleted' using errcode = '23514';
    end if;

    if new.checkout_on is not null then
      raise exception 'resident_activation_checked_out' using errcode = '23514';
    end if;

    if new.status in ('suspended', 'checked_out', 'archived') then
      raise exception 'resident_activation_blocked_status:%', new.status using errcode = '23514';
    end if;

    if new.onboarding_status = 'suspended'::public.resident_onboarding_status_enum then
      raise exception 'resident_activation_blocked_onboarding_status:%', new.onboarding_status using errcode = '23514';
    end if;

    if not v_protected_changed
       and (old.user_id is null or old.user_id = new.user_id)
       and new.user_id is not null
       and new.onboarding_status in (
          'invited'::public.resident_onboarding_status_enum,
          'activated'::public.resident_onboarding_status_enum,
          'profile_incomplete'::public.resident_onboarding_status_enum,
          'documents_pending'::public.resident_onboarding_status_enum,
          'verification_pending'::public.resident_onboarding_status_enum,
          'verified'::public.resident_onboarding_status_enum,
          'rejected'::public.resident_onboarding_status_enum
       ) then
      return new;
    end if;

    raise exception
      'resident_activation_bootstrap_invalid_transition: status=%, onboarding_status=%, old_user_id=%, new_user_id=%, protected_changed=%',
      new.status,
      new.onboarding_status,
      old.user_id,
      new.user_id,
      v_protected_changed
      using errcode = '23514';
  end if;

  if public.is_service_context() or public.can_manage_organization(old.organization_id, old.hostel_id) then
    return new;
  end if;

  if public.owns_resident(old.id) then
    if old.status in ('suspended', 'checked_out', 'archived')
       or old.deleted_at is not null
       or old.onboarding_status = 'suspended'::public.resident_onboarding_status_enum then
      raise exception 'resident_profile_self_update_locked' using errcode = '42501';
    end if;

    if new.onboarding_status in ('verified', 'suspended')
       and new.onboarding_status is distinct from old.onboarding_status then
      raise exception 'resident_onboarding_self_transition_forbidden' using errcode = '42501';
    end if;

    if new.onboarding_status = 'verification_pending'::public.resident_onboarding_status_enum
       and (
         nullif(trim(coalesce(new.full_name, '')), '') is null
         or new.date_of_birth is null
         or nullif(trim(coalesce(new.phone, '')), '') is null
         or nullif(trim(coalesce(new.parent_name, '')), '') is null
         or nullif(trim(coalesce(new.parent_phone, '')), '') is null
         or nullif(trim(coalesce(new.emergency_contact_name, '')), '') is null
         or nullif(trim(coalesce(new.emergency_contact_phone, '')), '') is null
         or nullif(trim(coalesce(new.permanent_address, '')), '') is null
         or new.aadhaar_document_id is null
         or new.profile_image_document_id is null
         or new.student_id_document_id is null
       ) then
      raise exception 'resident_onboarding_requirements_missing' using errcode = '23514';
    end if;

    v_self_allowed_changed := (
      to_jsonb(new)
        - 'full_name'
        - 'preferred_name'
        - 'gender'
        - 'date_of_birth'
        - 'phone'
        - 'email'
        - 'aadhaar_last4'
        - 'aadhaar_document_id'
        - 'profile_image_document_id'
        - 'student_id_document_id'
        - 'parent_name'
        - 'parent_phone'
        - 'parent_email'
        - 'emergency_contact_name'
        - 'emergency_contact_phone'
        - 'permanent_address'
        - 'metadata'
        - 'onboarding_status'
        - 'onboarding_completed_at'
        - 'onboarding_rejection_reason'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
        - 'search_vector'
    ) is not distinct from (
      to_jsonb(old)
        - 'full_name'
        - 'preferred_name'
        - 'gender'
        - 'date_of_birth'
        - 'phone'
        - 'email'
        - 'aadhaar_last4'
        - 'aadhaar_document_id'
        - 'profile_image_document_id'
        - 'student_id_document_id'
        - 'parent_name'
        - 'parent_phone'
        - 'parent_email'
        - 'emergency_contact_name'
        - 'emergency_contact_phone'
        - 'permanent_address'
        - 'metadata'
        - 'onboarding_status'
        - 'onboarding_completed_at'
        - 'onboarding_rejection_reason'
        - 'onboarding_metadata'
        - 'updated_at'
        - 'updated_by'
        - 'search_vector'
    );

    if not v_self_allowed_changed then
      raise exception 'resident_profile_self_update_protected_fields' using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update resident profile' using errcode = '42501';
end;
$$;
