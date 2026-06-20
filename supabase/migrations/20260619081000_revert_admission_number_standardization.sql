-- Revert SDH admission number standardization support objects.
-- This intentionally does not update resident rows, preserving existing resident data.

begin;

drop trigger if exists standardize_operational_resident_admission_number_trg
  on public.residents;

drop function if exists public.standardize_operational_resident_admission_number();
drop function if exists public.assign_sdh_admission_number(uuid, uuid);
drop function if exists public.next_sdh_admission_number(integer);

drop index if exists public.residents_sdh_admission_number_uidx;
drop table if exists public.admission_number_counters;

commit;
