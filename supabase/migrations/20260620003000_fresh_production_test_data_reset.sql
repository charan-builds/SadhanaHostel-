-- One-time owner-authorized operational reset for fresh production testing.
-- The production safety configuration is restored before this transaction ends.

do $$
declare
  v_launch_mode text;
  v_next_public_launch_mode text;
  v_destructive_operations_enabled boolean;
begin
  select
    launch_mode,
    next_public_launch_mode,
    destructive_operations_enabled
  into
    v_launch_mode,
    v_next_public_launch_mode,
    v_destructive_operations_enabled
  from public.operational_safety_settings
  where id is true
  for update;

  update public.operational_safety_settings
  set launch_mode = 'staging',
      next_public_launch_mode = 'staging',
      destructive_operations_enabled = true,
      updated_at = clock_timestamp()
  where id is true;

  perform public.reset_resident_operational_data_for_staging(
    '5f458e9d-b984-46fd-a71c-18af6d4dcf28'::uuid,
    null,
    '9401e3b4-4138-48c2-adbd-a07a961d4983'::uuid,
    false,
    'RESET DEMO DATA'
  );

  update public.operational_safety_settings
  set launch_mode = v_launch_mode,
      next_public_launch_mode = v_next_public_launch_mode,
      destructive_operations_enabled = v_destructive_operations_enabled,
      updated_at = clock_timestamp()
  where id is true;
end;
$$;
